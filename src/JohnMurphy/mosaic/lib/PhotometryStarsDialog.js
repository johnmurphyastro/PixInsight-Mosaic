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
 * Display the photometry stars in a Dialog that contains a scrolled window and 
 * controls to adjust the photometry star parameters.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {Bitmap} tgtBitmap Background image of the target overlap area at 1:1 scale
 * @param {Number} nChannels
 * @param {StarsDetected} detectedStars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {PhotometryStarsDialog}
 */
function PhotometryStarsDialog(title, refBitmap, tgtBitmap, nChannels,
        detectedStars, data, photometricMosaicDialog)
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
    let selectedChannel = 3;    // 0=R, 1=G, 2=B, 3 = all
    let bitmapOffset = getBitmapOffset(data);
    let bitmap = getBitmap(selectedBitmap);
    let colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
    let starPairs = getStarPairs(selectedChannel);
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? refBitmap : tgtBitmap;
    }
    
    /**
     * @param {Number} channel
     * @returns {StarPair[]}
     */
    function getStarPairs(channel){
        starPairs = [];
        if (channel < colorStarPairs.length){
            // return stars from channel 0, 1 or 2
            starPairs = colorStarPairs[channel];
        } else if (colorStarPairs.length === 3){
            // return stars in all channels
            starPairs = colorStarPairs[0].concat(colorStarPairs[1], colorStarPairs[2]);
        } else {
            starPairs = colorStarPairs[0];
        }
        return starPairs;
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
    function drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            // Draw inner star flux square and outer background sky flux square
            for (let i = 0; i < starPairs.length; ++i){
                let starPair = starPairs[i];
                let tgtStar = starPair.tgtStar;
                let refStar = starPair.refStar;
                let x;
                let y;
                let s;
                if (selectedBitmap === REF){
                    x = refStar.pos.x - bitmapOffset.x;
                    y = refStar.pos.y - bitmapOffset.y;
                    s = Math.sqrt(refStar.size); // size is area of the square. s is length of side.
                } else {
                    x = tgtStar.pos.x - bitmapOffset.x;
                    y = tgtStar.pos.y - bitmapOffset.y;
                    s = Math.sqrt(tgtStar.size); // size is area of the square. s is length of side.
                }
                let rect = new Rect(s, s);
                rect.center = new Point(x, y);
                graphics.strokeRect(rect);
                let bg = rect.inflatedBy( detectedStars.bkgDelta );
                graphics.strokeRect(bg);
            }
        } catch(e) {
            console.criticalln("PhotometryStarsDialog drawPhotometryStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null);
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
        drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };

    // ========================================
    // User controls
    // ========================================
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display either reference background and stars, or " +
            "target background and stars.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        starPairs = getStarPairs(selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "Display the photometry stars detected within the red channel";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel = 0;
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "Display the photometry stars detected within the green channel";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel = 1;
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "Display the photometry stars detected within the blue channel";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel = 2;
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the photometry stars detected within all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel = 3;
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    if (colorStarPairs.length === 1){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }
    
    let optionsSizer = new HorizontalSizer();
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(redRadioButton);
    optionsSizer.add(greenRadioButton);
    optionsSizer.add(blueRadioButton);
    optionsSizer.add(allRadioButton);
    optionsSizer.addStretch();
    
    // ============================
    // Photometry controls
    // ============================
    const OUTLIER_REMOVAL_STRLEN = this.font.width("Outlier Removal:");
    let limitPhotoStarsPercent_Control = 
            createLimitPhotoStarsPercentControl(this, data, OUTLIER_REMOVAL_STRLEN);
    limitPhotoStarsPercent_Control.onValueUpdated = function (value) {
        data.limitPhotoStarsPercent = value;
        update();
        photometricMosaicDialog.limitPhotoStarsPercent_Control.setValue(value);
    };
    
    let rejectHigh_Control = createLinearRangeControl(this, data, OUTLIER_REMOVAL_STRLEN);
    rejectHigh_Control.onValueUpdated = function (value) {
        data.linearRange = value;
        update();
        photometricMosaicDialog.rejectHigh_Control.setValue(value);
    };

    let outlierRemoval_Control = createOutlierRemovalControl(this, data, OUTLIER_REMOVAL_STRLEN);
    outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
        update();
        photometricMosaicDialog.outlierRemoval_Control.setValue(value);
    };


    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
        starPairs = getStarPairs(selectedChannel);
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(limitPhotoStarsPercent_Control);
    this.sizer.add(rejectHigh_Control);
    this.sizer.add(outlierRemoval_Control);
    this.sizer.add(optionsSizer);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + 20;
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            this.sizer.spacing * 5 + this.sizer.margin * 2 +
            refCheckBox.height + rejectHigh_Control.height * 3 + 20;
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

PhotometryStarsDialog.prototype = new Dialog;
