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
 * Display the Mask Stars in a Dialog that contains a scrolled window and 
 * controls to adjust the Mask Star parameters.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {Bitmap} tgtBitmap Background image of the target overlap area at 1:1 scale
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function MaskStarsDialog(title, refBitmap, tgtBitmap, joinArea, detectedStars, data,
        photometricMosaicDialog)
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
    let bitmapOffset = getBitmapOffset(data);
    let bitmap = getBitmap(selectedBitmap);
    let clipRect = getClipRect();
    
    /**
     * Create a clipRect based on the joinArea.
     * This is used to limit the star drawing to the join area.
     * @returns {Rect}
     */
    function getClipRect(){
        let x0 = joinArea.x0 - bitmapOffset.x;
        let y0 = joinArea.y0 - bitmapOffset.y;
        let x1 = joinArea.x1 - bitmapOffset.x;
        let y1 = joinArea.y1 - bitmapOffset.y;
        return new Rect(x0, y0, x1, y1);
    }
    
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
     */
    function drawMaskStars(viewport, translateX, translateY, scale){
        let graphics = new VectorGraphics(viewport);
        graphics.translateTransformation(translateX, translateY);
        graphics.scaleTransformation(scale, scale);
        graphics.pen = new Pen(0xffff0000);
        graphics.drawRect(clipRect);
        graphics.antialiasing = true;
        graphics.clipRect = clipRect;
        let allStars = detectedStars.allStars;
        let firstNstars;
        if (data.limitMaskStarsPercent < 100){
            firstNstars = Math.floor(allStars.length * data.limitMaskStarsPercent / 100);
        } else {
            firstNstars = allStars.length;
        }

        for (let i = 0; i < firstNstars; ++i){
            let star = allStars[i];
            // size is the area. sqrt gives box side length. Half gives circle radius
            let starDiameter = Math.sqrt(star.size);
            let x = star.pos.x - bitmapOffset.x;
            let y = star.pos.y - bitmapOffset.y;
            let starRadius = starDiameter * Math.pow(data.maskStarRadiusMult, star.peak) / 2;
            graphics.strokeCircle(x, y, starRadius + data.maskStarRadiusAdd);
        }
        graphics.end();
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
        drawMaskStars(viewport, translateX, translateY, scale);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };

    // ========================================
    // User controls
    // ========================================
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display reference or target image.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let optionsSizer = new HorizontalSizer();
    optionsSizer.margin = 4;
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();

    let starMaskLabelSize = this.font.width("Multiply star radius:");
    let limitMaskStars_Control = createLimitMaskStarsControl(this, data, starMaskLabelSize);
    limitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
        update();
        photometricMosaicDialog.limitMaskStars_Control.setValue(value);
    };
    
    let maskStarRadiusMult_Control = createMaskStarRadiusMultControl(this, data, starMaskLabelSize);
    maskStarRadiusMult_Control.onValueUpdated = function (value) {
        data.maskStarRadiusMult = value;
        update();
        photometricMosaicDialog.maskStarRadiusMult_Control.setValue(value);
    };
    
    let maskStarRadiusAdd_Control = createMaskStarRadiusAddControl(this, data, starMaskLabelSize);
    maskStarRadiusAdd_Control.onValueUpdated = function (value) {
        data.maskStarRadiusAdd = value;
        update();
        photometricMosaicDialog.maskStarRadiusAdd_Control.setValue(value);
    };

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 4;
    this.sizer.spacing = 4;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(limitMaskStars_Control);
    this.sizer.add(maskStarRadiusMult_Control);
    this.sizer.add(maskStarRadiusAdd_Control);

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + 50;
    let preferredHeight = previewControl.height + 50 + 4 * 5 + 
            refCheckBox.height + limitMaskStars_Control.height * 3;
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

MaskStarsDialog.prototype = new Dialog;
