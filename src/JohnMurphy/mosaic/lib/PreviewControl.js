/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow, Frame */

// This file is based on PreviewControl.js from the AnnotationImage script, 
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
//"use strict";
#include <pjsr/ButtonCodes.jsh>
#include <pjsr/StdCursor.jsh>

function PreviewControl(parent, image, metadata) {
    this.__base__ = Frame;
    this.__base__(parent);

    /**
     * 
     * @param {Bitmap} image The unscaled bitmap to display. It is not modified.
     * @param {width:, height:} metadata Specifies dimensions of drawing region if image = null
     * TODO check how metadata is used; Is it an independant draw area size?
     */
    this.setImage = function (image, metadata) {
        this.image = image;
        if (metadata){
            this.metadata = metadata;
        } else {
            this.metadata = {width: image.width, height:image.height};
        }
        // The zoomed bitmap, calculated from image.
        this.scaledImage = null;
        // Set the lower zoom limit when the whole image is visible.
        this.setZoomOutLimit();
        // This sets the inital zoom to 1:1. Use -100 to set to ZoomOutLimit.
        this.updateZoom(1, null);
    };

    /**
     * Update the zoom, constrained to the ZoomOutLimit
     * @param {Number} newZoom
     * @param {Point} refPoint Center zoom here (if null defaults to center of viewport).
     * refPoint is in local viewport coordinates
     */
    this.updateZoom = function (newZoom, refPoint) {
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
        gc(true);

        // Calculate scale from zoom index. e.g. 2 -> 2, 1 -> 1, 0 -> 1/2, -1 -> 1/3
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
    };

    this.zoomIn_Button = new ToolButton(this);
    this.zoomIn_Button.icon = this.scaledResource(":/icons/zoom-in.png");
    this.zoomIn_Button.setScaledFixedSize(24, 24);
    this.zoomIn_Button.toolTip = "Zoom In";
    this.zoomIn_Button.onMousePress = function ()
    {
        this.parent.updateZoom(this.parent.zoom + 1, null);
    };

    this.zoomOut_Button = new ToolButton(this);
    this.zoomOut_Button.icon = this.scaledResource(":/icons/zoom-out.png");
    this.zoomOut_Button.setScaledFixedSize(24, 24);
    this.zoomOut_Button.toolTip = "Zoom Out";
    this.zoomOut_Button.onMousePress = function ()
    {
        this.parent.updateZoom(this.parent.zoom - 1, null);
    };

    this.zoom11_Button = new ToolButton(this);
    this.zoom11_Button.icon = this.scaledResource(":/icons/zoom-1-1.png");
    this.zoom11_Button.setScaledFixedSize(24, 24);
    this.zoom11_Button.toolTip = "Zoom 1:1";
    this.zoom11_Button.onMousePress = function ()
    {
        this.parent.updateZoom(1, null);
    };

    this.zoom = 1;
    this.scale = 1;
    this.zoomOutLimit = -5;
    this.scrollbox = new ScrollBox(this);
    this.scrollbox.autoScroll = true;
    this.scrollbox.tracking = true;
    this.scrollbox.cursor = new Cursor(StdCursor_UpArrow);
    this.scrollbox.pageHeight = this.scrollbox.viewport.height;
    this.scrollbox.pageWidth = this.scrollbox.viewport.width;
    this.scrollbox.lineHeight = 10;
    this.scrollbox.lineWidth = 10;

    this.scroll_Sizer = new HorizontalSizer;
    this.scroll_Sizer.add(this.scrollbox);

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
        let preview = this.parent.parent;
        preview.updateZoom(preview.zoom + ((delta > 0) ? -1 : 1), new Point(x, y));
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
        let preview = this.parent.parent;
        if (preview.scrolling || button !== MouseButton_Left)
            return;
        preview.scrolling = {
            orgCursor: new Point(x, y),
            orgScroll: new Point(preview.scrollbox.horizontalScrollPosition, preview.scrollbox.verticalScrollPosition)
        };
        this.cursor = new Cursor(StdCursor_ClosedHand);
    };

    /**
     * Display cursor postion in image coordinates, if in pan mode scroll image.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseMove = function (x, y, buttonState, modifiers) {
        let preview = this.parent.parent;
        if (preview.scrolling) {
            preview.scrollbox.horizontalScrollPosition = preview.scrolling.orgScroll.x - (x - preview.scrolling.orgCursor.x);
            preview.scrollbox.verticalScrollPosition = preview.scrolling.orgScroll.y - (y - preview.scrolling.orgCursor.y);
        }

        if (preview.updateCoord){
            // (ox, oy) is the scaled image origin in viewport coordinates
            let ox = (this.parent.maxHorizontalScrollPosition > 0) ?
                    -this.parent.horizontalScrollPosition : (this.width - preview.scaledImage.width) / 2;
            let oy = (this.parent.maxVerticalScrollPosition > 0) ?
                    -this.parent.verticalScrollPosition : (this.height - preview.scaledImage.height) / 2;

            // coordPx is the cursor position in this.image bitmap coordinates
            let coordPx = new Point((x - ox) / preview.scale, (y - oy) / preview.scale);
            if (coordPx.x < 0 ||
                    coordPx.x > preview.metadata.width ||
                    coordPx.y < 0 ||
                    coordPx.y > preview.metadata.height)
            {
                // cursor is not over the image
                preview.updateCoord(null);
            } else {
                preview.updateCoord(coordPx);
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
        let preview = this.parent.parent;
        if (preview.scrolling && button === MouseButton_Left) {
            preview.scrollbox.horizontalScrollPosition = preview.scrolling.orgScroll.x - (x - preview.scrolling.orgCursor.x);
            preview.scrollbox.verticalScrollPosition = preview.scrolling.orgScroll.y - (y - preview.scrolling.orgCursor.y);
            preview.scrolling = null;
            this.cursor = new Cursor(StdCursor_UpArrow);
        }
    };

    this.scrollbox.viewport.onResize = function (wNew, hNew, wOld, hOld) {
        let preview = this.parent.parent;
        if (preview.scaledImage) {
            this.parent.maxHorizontalScrollPosition = Math.max(0, preview.scaledImage.width - wNew);
            this.parent.maxVerticalScrollPosition = Math.max(0, preview.scaledImage.height - hNew);
            this.parent.pageHeight = this.parent.viewport.height;
            this.parent.pageWidth = this.parent.viewport.width;
            preview.setZoomOutLimit();
            preview.updateZoom(preview.zoom, null);
        }
        this.update();
    };

    this.scrollbox.viewport.onPaint = function (x0, y0, x1, y1) {
        let preview = this.parent.parent;
        let graphics = new VectorGraphics(this);

        graphics.fillRect(x0, y0, x1, y1, new Brush(0xff202020));

        let offsetX = (this.parent.maxHorizontalScrollPosition > 0) ?
                -this.parent.horizontalScrollPosition : (this.width - preview.scaledImage.width) / 2;
        let offsetY = (this.parent.maxVerticalScrollPosition > 0) ?
                -this.parent.verticalScrollPosition : (this.height - preview.scaledImage.height) / 2;
        graphics.translateTransformation(offsetX, offsetY);

        if (preview.image)
            graphics.drawBitmap(0, 0, preview.scaledImage);
        else
            graphics.fillRect(0, 0, preview.scaledImage.width, preview.scaledImage.height, new Brush(0xff000000));

        graphics.pen = new Pen(0xffffffff, 0);
        graphics.drawRect(-1, -1, preview.scaledImage.width + 1, preview.scaledImage.height + 1);

        if (preview.onCustomPaint) {
            graphics.antialiasing = true;
            graphics.scaleTransformation(preview.scale, preview.scale);
            preview.onCustomPaint.call(preview.onCustomPaintScope, graphics, x0, y0, x1, y1);
        }

        graphics.end();
    };

    this.zoomButton_Sizer = new HorizontalSizer();
    this.zoomButton_Sizer.margin = 4;
    this.zoomButton_Sizer.spacing = 4;
    this.zoomButton_Sizer.add(this.zoomIn_Button);
    this.zoomButton_Sizer.add(this.zoomOut_Button);
    this.zoomButton_Sizer.add(this.zoom11_Button);
    this.zoomButton_Sizer.addStretch();

    this.sizer = new VerticalSizer();
    this.sizer.add(this.scroll_Sizer);
    this.sizer.add(this.zoomButton_Sizer);
    
    this.setImage(image, metadata);
    
    this.width = Math.min(this.logicalPixelsToPhysical(1800), image.width + 10);
    this.height = Math.min(this.logicalPixelsToPhysical(1000), image.height + this.zoomIn_Button.height + 20);
}

PreviewControl.prototype = new Frame;
