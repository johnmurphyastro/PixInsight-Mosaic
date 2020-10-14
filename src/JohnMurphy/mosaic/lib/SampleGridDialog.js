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
 * Display the SampleGrid in a Dialog that contains a scrolled window and 
 * controls to adjust the SampleGrid parameters.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {Bitmap} tgtBitmap Background image of the target overlap area at 1:1 scale
 * @param {SampleGridMap} sampleGridMap Specifies the grid samples
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {Number} maxSampleSize maximum allowed sample size
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function SampleGridDialog(title, refBitmap, tgtBitmap, sampleGridMap, detectedStars, data,
        maxSampleSize, photometricMosaicDialog)
{
    this.__base__ = Dialog;
    this.__base__();
    
    const REF = 10;
    const TGT = 20;
    let self = this;
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let selectedBitmap = REF;
    let bitmap = getBitmap(selectedBitmap);
    let bitmapOffset = getBitmapOffset(data);
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? refBitmap : tgtBitmap;
    }
    
    /**
     * The offset between the full mosaic image and the bounding box of the overlap area.
     * Note that bitmap is of the overlap area.
     * @param {PhotometricMosaicData} data
     * @returns {Point} bitmap offset
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
     * @param {Point} point cursor coordinates relative to the (1:1) bitmap
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
     * Draw on top of the background bitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            graphics.antialiasing = false;
            // Draw the sample grid
            for (let binRect of sampleGridMap.getBinRectArray(0)){
                let rect = new Rect(binRect);
                rect.translateBy(-bitmapOffset.x, -bitmapOffset.y);
                graphics.drawRect(rect);
            }

            // Draw circles around the stars used to reject grid sample squares
            let stars = detectedStars.allStars;
            let firstNstars;
            if (data.limitSampleStarsPercent < 100){
                firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
            } else {
                firstNstars = stars.length;
            }
            graphics.antialiasing = true;
            graphics.pen = new Pen(0xffff0000, 1.5);
            for (let i = 0; i < firstNstars; ++i){
                let star = stars[i];
                let radius = Math.sqrt(star.size)/2;
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                graphics.strokeCircle(x, y, radius);
            }
        } catch (e) {
            console.criticalln("drawSampleGrid error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    let liveUpdate = false;
    
    /**
     * @param {HorizontalSizer} horizontalSizer
     */
    function customControls (horizontalSizer){
        let liveUpdate_control = new CheckBox(self);
        liveUpdate_control.text = "Live update";
        liveUpdate_control.toolTip = "<p>Live update. Deselect if controls are sluggish.</p>";
        liveUpdate_control.onCheck = function (checked){
            liveUpdate = checked;
            update_Button.enabled = !checked;
            if (checked){
                self.enabled = false;
                processEvents();
                updateSampleGrid();
                self.enabled = true;
            }
        };
        liveUpdate_control.checked = liveUpdate;

        let update_Button = new PushButton(self);
        update_Button.text = "Update";
        update_Button.toolTip = "<p>Update display</p>";
        update_Button.onClick = function(){
            self.enabled = false;
            processEvents();
            updateSampleGrid();
            self.enabled = true;
        };
        update_Button.enabled = !liveUpdate_control.checked;
        
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(liveUpdate_control);
        horizontalSizer.addSpacing(6);
        horizontalSizer.add(update_Button);
        horizontalSizer.addSpacing(20);
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null, customControls, false);
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
        drawSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };
    
    // ========================================
    // User controls
    // ========================================
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display either the reference or target background.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        updateSampleGrid();
        self.enabled = true;
    };
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();
    
    const labelLength = this.font.width("Multiply star radius:");
    let limitSampleStarsPercent_Control = 
                createLimitSampleStarsPercentControl(this, data, labelLength);
        limitSampleStarsPercent_Control.onValueUpdated = function (value) {
            data.limitSampleStarsPercent = value;
            photometricMosaicDialog.limitSampleStarsPercent_Control.setValue(value);
            if (liveUpdate){
                updateSampleGrid();
            }
        };

    let sampleStarRadiusMult_Control =
                createSampleStarRadiusMultControl(this, data, labelLength);
        sampleStarRadiusMult_Control.onValueUpdated = function (value){
            data.sampleStarRadiusMult = value;
            photometricMosaicDialog.sampleStarRadiusMult_Control.setValue(value);
            if (liveUpdate){
                updateSampleGrid();
            }
        };

    let sampleSize_Control = createSampleSizeControl(this, data, maxSampleSize, labelLength);
        sampleSize_Control.onValueUpdated = function (value) {
            data.sampleSize = value;
            photometricMosaicDialog.sampleSize_Control.setValue(value);
            if (liveUpdate){
                updateSampleGrid();
            }
        };
    
    /**
     * Create a new SampleGridMap from the updated parameters, and draw it 
     * on top of the background bitmap within the scrolled window.
     */
    function updateSampleGrid(){
        sampleGridMap = data.cache.getSampleGridMap(data.targetView.image, data.referenceView.image,
            detectedStars.allStars, data.cache.overlap.overlapBox, data);
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(limitSampleStarsPercent_Control);
    this.sizer.add(sampleSize_Control);
    this.sizer.add(sampleStarRadiusMult_Control);
    this.sizer.add(optionsSizer);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the bitmap
    // The dialog must also leave enough room for the extra controls we are adding
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            this.sizer.spacing * 5 + this.sizer.margin * 2 +
            refCheckBox.height + limitSampleStarsPercent_Control.height * 3 + this.logicalPixelsToPhysical(20);
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

//-------------------------------------------------------
// Sample Grid Controls
//-------------------------------------------------------
function createLimitSampleStarsPercentControl(dialog, data, sampleGenerationStrLen){
    let limitSampleStarsPercent_Control = new NumericControl(dialog);
    limitSampleStarsPercent_Control.real = false;
    limitSampleStarsPercent_Control.label.text = "Limit stars %:";
    limitSampleStarsPercent_Control.label.minWidth = sampleGenerationStrLen;
    limitSampleStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. This can affect how many of the " +
            "pixels illuminated by a star fall into a neighboring sample.</li></ul>" +
            "<p>It is only necessary to reject bright stars. This script uses the " +
            "median value from each sample, so any star that takes up less than " +
            "half the sample area will have little effect. It is more important to " +
            "include most of the samples than to reject faint stars.</p>";
    limitSampleStarsPercent_Control.setRange(0, 100);
    limitSampleStarsPercent_Control.slider.setRange(0, 100);
    limitSampleStarsPercent_Control.slider.minWidth = 101;
    limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);
    return limitSampleStarsPercent_Control;
}
 
function createSampleStarRadiusMultControl(dialog, data, labelLength){
    let sampleStarRadiusMult_Control = new NumericControl(dialog);
    sampleStarRadiusMult_Control.real = true;
    sampleStarRadiusMult_Control.label.text = "Multiply star radius:";
    sampleStarRadiusMult_Control.label.minWidth = labelLength;
    sampleStarRadiusMult_Control.toolTip =
            "<p>Increase to reject more samples around saturated stars.</p>" +
            "<p>Read the Help sections on 'Join Region' to learn when these " +
            "samples should be rejected.</p>";
    sampleStarRadiusMult_Control.setPrecision(1);
    sampleStarRadiusMult_Control.setRange(1, 25);
    sampleStarRadiusMult_Control.slider.setRange(1, 250);
    sampleStarRadiusMult_Control.slider.minWidth = 250;
    sampleStarRadiusMult_Control.setValue(data.sampleStarRadiusMult);
    return sampleStarRadiusMult_Control;
}
 
function createSampleSizeControl(dialog, data, maxSampleSize, labelLength){
    let sampleSize_Control = new NumericControl(dialog);
    sampleSize_Control.real = false;
    sampleSize_Control.label.text = "Sample size:";
    sampleSize_Control.label.minWidth = labelLength;
    sampleSize_Control.toolTip =
            "<p>Specifies the size of the sample squares.</p>" +
            "<p>The sample size should be greater than 2x the size of the largest " +
            "star that's not rejected by 'Limit stars %'.</p>";
    sampleSize_Control.setRange(2, Math.min(maxSampleSize, 50));
    sampleSize_Control.slider.setRange(2, 50);
    sampleSize_Control.slider.minWidth = 50;
    sampleSize_Control.setValue(data.sampleSize);
    return sampleSize_Control;
}

SampleGridDialog.prototype = new Dialog;
