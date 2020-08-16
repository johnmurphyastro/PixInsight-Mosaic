/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow, StdCursor_Checkmark */

// Version 1.0 (c) John Murphy 30th-July-2020
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
 * Display the Binned Sample Grid in a Dialog that contains a scrolled window and 
 * controls to adjust the Binned Sample Grid parameters.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {SamplePair[]} samplePairs Specifies the grid samples
 * @param {Boolean} isHorizontal Join orientation
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {BinnedSampleGridDialog}
 */
function BinnedSampleGridDialog(title, refBitmap, samplePairs,
        isHorizontal, detectedStars, data, photometricMosaicDialog)
{
    this.__base__ = Dialog;
    this.__base__();
    
    let self = this;
    
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let bitmapOffset = getBitmapOffset(data);
    let showUnbinnedSamples = false;
    let binnedSamplePairs = getBinnedSamplePairs();
    
    /**
     * The offset between the full mosaic image and the bounding box of the overlap area.
     * Note that refBitmap is of the overlap area.
     * @param {PhotometricMosaicData} data
     * @returns {Point} refBitmap offset
     */
    function getBitmapOffset(data){
        let overlapBox = data.cache.overlap.overlapBox;
        return new Point(overlapBox.x0, overlapBox.y0);
    }
    
    /**
     * Set dialog title, including the current zoom and cursor coordinates
     */
    function setTitle(){
        self.windowTitle = title + " " + zoomText + " " + coordText;
    };
    
    /**
     * Set coordText, the cursor coordinate text. The coordText
     * is relative to the full mosaic image's top left corner.
     * @param {Point} point cursor coordinates relative to the (1:1) refBitmap
     */
    function setCoordText(point){
        if (point === null){
            coordText = "(---,---)";
        } else {
            let x = bitmapOffset.x + point.x;
            let y = bitmapOffset.y + point.y;
            coordText = format("(%8.2f,%8.2f )", x, y);
        }
    }
    
    /**
     * Draw on top of the background refBitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawBinnedSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            // Draw the sample grid
            if (showUnbinnedSamples){
                graphics.pen = new Pen(0xff0000ff);
                graphics.antialiasing = false;
                samplePairs.forEach(function (samplePair) {
                    let rect = new Rect(samplePair.rect);
                    rect.translateBy(-bitmapOffset.x, -bitmapOffset.y);
                    graphics.drawRect(rect);
                });
                let stars = detectedStars.allStars;
                let firstNstars;
                if (data.limitSampleStarsPercent < 100){
                    firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
                } else {
                    firstNstars = stars.length;
                }
                graphics.pen = new Pen(0xffff0000, 1.5);
                graphics.antialiasing = true;
                for (let i = 0; i < firstNstars; ++i){
                    let star = stars[i];
                    let radius = Math.sqrt(star.size)/2;
                    let x = star.pos.x - bitmapOffset.x;
                    let y = star.pos.y - bitmapOffset.y;
                    graphics.strokeCircle(x, y, radius);
                }
            }
            graphics.pen = new Pen(0xffff0000);
            graphics.antialiasing = false;
            binnedSamplePairs.forEach(function (samplePair) {
                let rect = new Rect(samplePair.rect);
                rect.translateBy(-bitmapOffset.x, -bitmapOffset.y);
                graphics.drawRect(rect);
            });
        } catch (e) {
            console.criticalln("drawBinnedSampleGrid error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, refBitmap, null);
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        setCoordText(point);
        setTitle();
    };
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        drawBinnedSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };
    
    // ========================================
    // User controls
    // ========================================
    let unbinnedCheckBox = new CheckBox(this);
    unbinnedCheckBox.text = "Show unbinned samples";
    unbinnedCheckBox.toolTip = "If selected show the unbinned samples in blue.";
    unbinnedCheckBox.checked = showUnbinnedSamples;
    unbinnedCheckBox.onClick = function (checked) {
        showUnbinnedSamples = checked;
        previewControl.forceRedraw();
    };
    
    let optionsSizer = new HorizontalSizer();
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(unbinnedCheckBox);
    optionsSizer.addStretch();
    
    let maxSamples_Control = createMaxSamplesControl(this, data);
    maxSamples_Control.onValueUpdated = function (value) {
        data.maxSamples = value;
        updateSampleGrid();
        photometricMosaicDialog.maxSamples_Control.setValue(value);
    };
    
    /**
     * @returns {SamplePair[]}
     */
    function getBinnedSamplePairs(){
        let overlapBox = data.cache.overlap.overlapBox;
        let binnedPairs = createBinnedSampleGrid(overlapBox, samplePairs, 
                isHorizontal, data.maxSamples);
        return binnedPairs;
    }
    
    /**
     * Create a new binned sample grid from the updated parameters, and draw it 
     * on top of the background refBitmap within the scrolled window.
     */
    function updateSampleGrid(){
        binnedSamplePairs = getBinnedSamplePairs();
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(maxSamples_Control);
    this.sizer.add(optionsSizer);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the refBitmap
    // The dialog must also leave enough room for the extra controls we are adding
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + 20;
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            this.sizer.spacing * 3 + this.sizer.margin * 2 +
            unbinnedCheckBox.height + maxSamples_Control.height + 20;
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

BinnedSampleGridDialog.prototype = new Dialog;
