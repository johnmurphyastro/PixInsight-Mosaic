/* global Dialog, MouseButton_Left, Frame, UndoFlag_NoSwapFile */

// (c) John Murphy 4th-July-2020
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";

/**
 * Extract the overlap image from the supplied view.
 * The view is cropped to the overlap bounding box. Any pixels within this 
 * bounding box that are not part of the overlap are set to black.
 * The resulting image has the original STF applied as a stretch and is 
 * returned as a bitmap image.
 * @param {View} refView The overlap image will be extracted from the image in this view.
 * @param {Rect} imageRect The overlap bounding box rectangle.
 * @param {TypedArray} maskSamples Specifies the overlapping pixels.
 * @returns {Bitmap} Image of the overlapping pixels
 */
function extractOverlapImage(refView, imageRect, maskSamples){
    /**
     * Get all the samples from the image that are within the area rectangle.
     * @param {Float32Array} refSamples Overlap area from refView (modified)
     * @param {Float32Array} mask If mask is zero, set refSamples to zero
     */
    function applyMask(refSamples, mask) {
        for (let i = mask.length - 1; i > -1; i--) {
            if (mask[i] === 0) {
                refSamples[i] = 0;
            }
        }
    };
    
    if (maskSamples.length !== imageRect.width * imageRect.height){
        console.criticalln("PreviewControl extractOverlapImage error: mask does not match crop area.\n" +
                "Mask buffer length = " + maskSamples.length + 
                "\nCrop rectangle = " + imageRect);
        return null; // TODO should throw exception
    }
    let refImage = refView.image;
    let refSamples = new Float32Array(maskSamples.length);
    let rect = new Rect(imageRect.width, imageRect.height);
    
    // Create a temporary view just big enough for the overlapping region's bounding box
    // Width, height, n channels, bitsPerSample, float, color, title
    let w = new ImageWindow(imageRect.width, imageRect.height, 3, 16, false, true, "OverlapImage");
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    if (refImage.isColor){
        for (let c = 0; c < 3; c++){
            refImage.getSamples(refSamples, imageRect, c);
            applyMask(refSamples, maskSamples);
            view.image.setSamples(refSamples, rect, c);
        }
    } else {
        refImage.getSamples(refSamples, imageRect, 0);
        applyMask(refSamples, maskSamples);
        view.image.setSamples(refSamples, rect, 0);
        view.image.setSamples(refSamples, rect, 1);
        view.image.setSamples(refSamples, rect, 2);
    }
    view.endProcess();

    // Apply a Histogram Transformation based on the reference view's STF
    // before converting this temporary view into a bitmap
    let stf = refView.stf;
    var HT = new HistogramTransformation;
    HT.H = 
        [[stf[0][1], stf[0][0], stf[0][2], 0, 1],
        [stf[0][1], stf[0][0], stf[0][2], 0, 1],
        [stf[0][1], stf[0][0], stf[0][2], 0, 1],
        [0, 0.5, 1, 0, 1],
        [0, 0.5, 1, 0, 1]];
    HT.executeOn(view, false); // no swap file

    let bitmap = view.image.render();
    w.close();
    return bitmap;
}

// the PreviewControl method is based on PreviewControl.js from the AnnotationImage script, 
// which has the following copyright notice:
/*
 Preview Control
 
 This file is part of the AnnotateImage script
 
 Copyright (C) 2013-2020, Andres del Pozo
 Contributions (C) 2019-2020, Juan Conejero (PTeam)
 All rights reserved.
 
 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:
 
 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.
 
 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
 */
// Modified by John Murphy

/**
 * 
 * @param {UIObject} parent
 * @param {Bitmap} image image The unscaled bitmap to display. It is not modified.
 * @param {width:, height:} metadata Specifies dimensions of drawing region if image = null
 * @param {Function(HorizontalSizer)} customControls e.g. add 'Live update' and 'Update' controls
 * @returns {PreviewControl}
 */
function PreviewControl(parent, image, metadata, customControls) {
    this.__base__ = Frame;
    this.__base__(parent);
    
    let self = this;

    /**
     * Set the background image, or the drawing area if the image is null
     * @param {Bitmap} image The unscaled bitmap to display. It is not modified.
     * @param {width:, height:} metadata Specifies dimensions of drawing region if image = null
     */
    this.setImage = function (image, metadata) {
        if (metadata){
            this.metadata = metadata;
        } else {
            this.metadata = {width: image.width, height:image.height};
        }
        // The original bitmap at 1:1 scale
        this.image = image;
        // The zoomed bitmap, calculated from this.image
        this.scaledImage = null;
        // Set the lower zoom limit when the whole image is visible
        this.setZoomOutLimit();
        // This sets the inital zoom to 1:1. Use -100 to set to ZoomOutLimit
        this.updateZoom(1, null);
    };
    
    /**
     * Update the background image. The new image must be the same size as the
     * original image.
     * This also updates the scaled image. The scroll position and zoom level
     * are left unchanged.
     * @param {Bitmap} image
     */
    this.updateBitmap = function (image){
        if (image.width === this.image.width && image.height === this.image.height){
            this.image = image;
            this.scaledImage = this.image.scaled(this.scale);
        } else {
            console.criticalln("PreviewControl error: bitmap size changed");
        }
    };

    /**
     * Update the zoom, constrained to the ZoomOutLimit. Max zoom = 4.
     * If newZoom > 0 and <= 4, scale = newZoom
     * If newZoom <= 0 and >= zoomOutLimit, scale = 1/(-newZoom + 2)
     * e.g. 2 -> 2, 1 -> 1, 0 -> 1/2, -1 -> 1/3
     * @param {Number} newZoom
     * @param {Point} refPoint Center zoom here (if null defaults to center of viewport).
     * refPoint is in local viewport coordinates
     */
    this.updateZoom = function (newZoom, refPoint) {
        try {
            newZoom = Math.max(this.zoomOutLimit, Math.min(4, newZoom));
            if (newZoom === this.zoom && this.scaledImage)
                return; // no change

            if (refPoint === null) // default to center
                refPoint = new Point(this.scrollbox.viewport.width / 2, this.scrollbox.viewport.height / 2);

            // imgx and imgy are in this.image coordinates (i.e. 1:1 scale)
            let imgx = null;
            if (this.scrollbox.maxHorizontalScrollPosition > 0)
                imgx = (refPoint.x + this.scrollbox.horizontalScrollPosition) / this.scale;

            let imgy = null;
            if (this.scrollbox.maxVerticalScrollPosition > 0)
                imgy = (refPoint.y + this.scrollbox.verticalScrollPosition) / this.scale;

            this.zoom = newZoom;
            this.scaledImage = null;

            // Calculate scale from zoom index. 
            // Update zoom text
            let zoomText;
            if (this.zoom > 0) {
                this.scale = this.zoom;
                zoomText = format("%d:1", this.zoom);
            } else {
                this.scale = 1 / (-this.zoom + 2);
                zoomText = format("1:%d", -this.zoom + 2);
            }
            if (this.updateZoomText){
                this.updateZoomText(zoomText);
            }

            if (this.image) {
                // Create zoomed image from the original bitmap
                this.scaledImage = this.image.scaled(this.scale);
            } else {
                // No bitmap image was supplied.
                // scaledImage will only contain the width and height
                this.scaledImage = {
                    width: this.metadata.width * this.scale,
                    height: this.metadata.height * this.scale
                };
            }

            this.scrollbox.maxHorizontalScrollPosition = Math.max(0, this.scaledImage.width - this.scrollbox.viewport.width);
            this.scrollbox.maxVerticalScrollPosition = Math.max(0, this.scaledImage.height - this.scrollbox.viewport.height);

            // Scroll to keep the refPoint in the correct place
            if (this.scrollbox.maxHorizontalScrollPosition > 0 && imgx !== null)
                this.scrollbox.horizontalScrollPosition = imgx * this.scale - refPoint.x;
            if (this.scrollbox.maxVerticalScrollPosition > 0 && imgy !== null)
                this.scrollbox.verticalScrollPosition = imgy * this.scale - refPoint.y;

            this.scrollbox.viewport.update();
        } catch(e){
            console.criticalln("PreviewControl updateZoom error: " + e);
        }
    };
    
    this.zoomIn_Button = new ToolButton(this);
    this.zoomIn_Button.icon = this.scaledResource(":/icons/zoom-in.png");
    this.zoomIn_Button.setScaledFixedSize(24, 24);
    this.zoomIn_Button.toolTip = "Zoom In";
    this.zoomIn_Button.onMousePress = function ()
    {
        self.updateZoom(self.zoom + 1, null);
    };

    this.zoomOut_Button = new ToolButton(this);
    this.zoomOut_Button.icon = this.scaledResource(":/icons/zoom-out.png");
    this.zoomOut_Button.setScaledFixedSize(24, 24);
    this.zoomOut_Button.toolTip = "Zoom Out";
    this.zoomOut_Button.onMousePress = function ()
    {
        self.updateZoom(self.zoom - 1, null);
    };

    this.zoom11_Button = new ToolButton(this);
    this.zoom11_Button.icon = this.scaledResource(":/icons/zoom-1-1.png");
    this.zoom11_Button.setScaledFixedSize(24, 24);
    this.zoom11_Button.toolTip = "Zoom 1:1";
    this.zoom11_Button.onMousePress = function ()
    {
        self.updateZoom(1, null);
    };

    this.zoom = 1;
    this.scale = 1;
    this.zoomOutLimit = -5;
    this.scrollbox = new ScrollBox(this);
    this.scrollbox.autoScroll = true;
    this.scrollbox.tracking = true;
    this.scrollbox.pageHeight = this.scrollbox.viewport.height;
    this.scrollbox.pageWidth = this.scrollbox.viewport.width;
    this.scrollbox.lineHeight = 10;
    this.scrollbox.lineWidth = 10;

    this.scroll_Sizer = new HorizontalSizer;
    this.scroll_Sizer.add(this.scrollbox);
    
    this.scrolling = null;

    /**
     * Prevents zoom out beyond the point where the whole image is visible
     */
    this.setZoomOutLimit = function () {
        let scaleX = Math.ceil(this.metadata.width / this.scrollbox.viewport.width);
        let scaleY = Math.ceil(this.metadata.height / this.scrollbox.viewport.height);
        let scale = Math.max(scaleX, scaleY);
        this.zoomOutLimit = -scale + 2;
    };

    this.scrollbox.onHorizontalScrollPosUpdated = function (newPos) {
        this.viewport.update();
    };

    this.scrollbox.onVerticalScrollPosUpdated = function (newPos) {
        this.viewport.update();
    };

    this.forceRedraw = function () {
        this.scrollbox.viewport.update();
    };

    /**
     * Mouse wheel zoom
     * @param {Number} x
     * @param {Number} y
     * @param {Number} delta
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseWheel = function (x, y, delta, buttonState, modifiers) {
        self.updateZoom(self.zoom + ((delta > 0) ? -1 : 1), new Point(x, y));
    };

    /**
     * If left mouse button press, start pan mode
     * @param {Number} x
     * @param {Number} y
     * @param {Number} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMousePress = function (x, y, button, buttonState, modifiers) {
        if (self.scrolling || button !== MouseButton_Left)
            return;
        self.scrolling = {
            orgCursor: new Point(x, y),
            orgScroll: new Point(self.scrollbox.horizontalScrollPosition, self.scrollbox.verticalScrollPosition)
        };
        // Setting the cursor does not work. Don't know why.
        // this.cursor = new Cursor(StdCursor_ClosedHand);
    };

    /**
     * Display cursor postion in image coordinates, if in pan mode scroll image.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseMove = function (x, y, buttonState, modifiers) {
        if (self.scrolling) {
            self.scrollbox.horizontalScrollPosition = self.scrolling.orgScroll.x - (x - self.scrolling.orgCursor.x);
            self.scrollbox.verticalScrollPosition = self.scrolling.orgScroll.y - (y - self.scrolling.orgCursor.y);
        }

        if (self.updateCoord){
            // (ox, oy) is the scaled image origin in viewport coordinates
            let ox = (this.parent.maxHorizontalScrollPosition > 0) ?
                    -this.parent.horizontalScrollPosition : (this.width - self.scaledImage.width) / 2;
            let oy = (this.parent.maxVerticalScrollPosition > 0) ?
                    -this.parent.verticalScrollPosition : (this.height - self.scaledImage.height) / 2;

            // coordPx is the cursor position in this.image bitmap coordinates
            let coordPx = new Point((x - ox) / self.scale, (y - oy) / self.scale);
            if (coordPx.x < 0 ||
                    coordPx.x > self.metadata.width ||
                    coordPx.y < 0 ||
                    coordPx.y > self.metadata.height)
            {
                // cursor is not over the image
                self.updateCoord(null);
            } else {
                self.updateCoord(coordPx);
            }
        }
    };

    /**
     * On left mouse button release, if in pan mode update scroll position and exit pan mode
     * @param {Number} x
     * @param {Number} y
     * @param {Number} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseRelease = function (x, y, button, buttonState, modifiers) {
        if (self.scrolling && button === MouseButton_Left) {
            self.scrollbox.horizontalScrollPosition = self.scrolling.orgScroll.x - (x - self.scrolling.orgCursor.x);
            self.scrollbox.verticalScrollPosition = self.scrolling.orgScroll.y - (y - self.scrolling.orgCursor.y);
            self.scrolling = null;
            // Setting the cursor does not work. Don't know why.
            // this.cursor = new Cursor(StdCursor_Arrow);
        }
    };

    /**
     * @param {Number} wNew New width
     * @param {Number} hNew New height
     * @param {Number} wOld old width
     * @param {Number} hOld old height
     */
    this.scrollbox.viewport.onResize = function (wNew, hNew, wOld, hOld) {
        try {
            if (self.scaledImage) {
                this.parent.maxHorizontalScrollPosition = Math.max(0, self.scaledImage.width - wNew);
                this.parent.maxVerticalScrollPosition = Math.max(0, self.scaledImage.height - hNew);
                this.parent.pageHeight = this.parent.viewport.height;
                this.parent.pageWidth = this.parent.viewport.width;
                self.setZoomOutLimit();
                self.updateZoom(self.zoom, null);
            }
            this.update();
        } catch(e){
            console.criticalln("PreviewControl onResize error: " + e);
        }
    };

    /**
     * @param {Number} x0 Viewport x0
     * @param {Number} y0 Viewport y0
     * @param {Number} x1 Viewport x1
     * @param {Number} y1 Viewport y1
     */
    this.scrollbox.viewport.onPaint = function (x0, y0, x1, y1) {
        let graphics;
        try {
            graphics = new VectorGraphics(this);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.fillRect(x0, y0, x1, y1, new Brush(0xff202020));

            let translateX = (this.parent.maxHorizontalScrollPosition > 0) ?
                    -this.parent.horizontalScrollPosition : (this.width - self.scaledImage.width) / 2;
            let translateY = (this.parent.maxVerticalScrollPosition > 0) ?
                    -this.parent.verticalScrollPosition : (this.height - self.scaledImage.height) / 2;
            graphics.translateTransformation(translateX, translateY);

            if (self.image)
                graphics.drawBitmap(0, 0, self.scaledImage);
            else
                graphics.fillRect(0, 0, self.scaledImage.width, self.scaledImage.height, new Brush(0xff000000));

            graphics.pen = new Pen(0xffffffff, 0);
            graphics.drawRect(-1, -1, self.scaledImage.width + 1, self.scaledImage.height + 1);

            if (self.onCustomPaint) {
                // Draw on top of the bitmap if onCustomPaint(...) method has been set
                self.onCustomPaint.call(self.onCustomPaintScope, 
                        this, translateX, translateY, self.scale, x0, y0, x1, y1);
            }
        } catch(e){
            console.criticalln("PreviewControl onPaint error: " + e);
        } finally {
            graphics.end();
        }
    };
    
    this.ok_Button = new PushButton();
    this.ok_Button.text = "OK";
    this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );

    this.getButtonSizer = function(){
        let zoomButton_Sizer = new HorizontalSizer();
        zoomButton_Sizer.margin = 0;
        zoomButton_Sizer.spacing = 4;
        zoomButton_Sizer.add(this.zoomIn_Button);
        zoomButton_Sizer.add(this.zoomOut_Button);
        zoomButton_Sizer.add(this.zoom11_Button);
        if (customControls){
            customControls(zoomButton_Sizer);
        }
        zoomButton_Sizer.addStretch();
        zoomButton_Sizer.add(this.ok_Button);
        zoomButton_Sizer.addSpacing(10);
        return zoomButton_Sizer;
    };
    this.getButtonSizerHeight = function(){
        return this.zoomIn_Button.height;
    };

    this.sizer = new VerticalSizer();
    this.sizer.add(this.scroll_Sizer);
    
    this.setImage(image, metadata);
    
    this.width = Math.min(this.logicalPixelsToPhysical(1800), image.width);
    this.height = Math.min(this.logicalPixelsToPhysical(900), image.height);
}

PreviewControl.prototype = new Frame;
