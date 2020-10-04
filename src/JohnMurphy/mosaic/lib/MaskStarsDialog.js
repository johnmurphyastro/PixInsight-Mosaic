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
 * @param {View} refView Background image of the reference overlap area at 1:1 scale
 * @param {View} tgtView Background image of the target overlap area at 1:1 scale
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function MaskStarsDialog(refView, tgtView, joinArea, detectedStars, data,
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
    
    let overlap = data.cache.overlap;
    let refBitmap = extractOverlapImage(refView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
    let tgtBitmap = extractOverlapImage(tgtView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
    
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
        self.windowTitle = "Star Mask " + zoomText + " " + coordText;
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
    function drawMaskStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            graphics.drawRect(clipRect);
            graphics.pen = new Pen(0xffff0000, 1.5);
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
        } catch (e) {
            console.criticalln("drawMaskStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    let liveUpdate = true;
    
    /**
     * @param {HorizontalSizer} horizontalSizer
     */
    function customControls (horizontalSizer){
        let liveUpdate_control = new CheckBox();
        liveUpdate_control.text = "Live update";
        liveUpdate_control.toolTip = "<p>Live update. Deselect if controls are sluggish.</p>";
        liveUpdate_control.onCheck = function (checked){
            liveUpdate = checked;
            update_Button.enabled = !checked;
            if (checked){
                update();
            }
        };
        liveUpdate_control.checked = liveUpdate;

        let update_Button = new PushButton();
        update_Button.text = "Update";
        update_Button.toolTip = "<p>Update display</p>";
        update_Button.onClick = function(){
            update();
        };
        update_Button.enabled = !liveUpdate_control.checked;
        
        let createMask_Button = new PushButton();
        createMask_Button.text = "Create";
        createMask_Button.toolTip = "<p>Create mask</p>";
        createMask_Button.onClick = function(){
            console.writeln("\n<b><u>Creating mosaic mask</u></b>");
            update();
            createStarMask(tgtView, joinArea, detectedStars, data);
        };
        
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(liveUpdate_control);
        horizontalSizer.addSpacing(10);
        horizontalSizer.add(update_Button);
        horizontalSizer.addSpacing(30);
        horizontalSizer.add(createMask_Button);
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null, customControls);
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
        drawMaskStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.text = "Close";
    previewControl.ok_Button.icon = null;
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
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();

    let starMaskLabelSize = this.font.width("Multiply star radius:");
    let limitMaskStars_Control = createLimitMaskStarsControl(this, data, starMaskLabelSize);
    limitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
        if (liveUpdate) {
            update();
        }
    };
    
    let maskStarRadiusMult_Control = createMaskStarRadiusMultControl(this, data, starMaskLabelSize);
    maskStarRadiusMult_Control.onValueUpdated = function (value) {
        data.maskStarRadiusMult = value;
        if (liveUpdate) {
            update();
        }
    };
    
    let maskStarRadiusAdd_Control = createMaskStarRadiusAddControl(this, data, starMaskLabelSize);
    maskStarRadiusAdd_Control.onValueUpdated = function (value) {
        data.maskStarRadiusAdd = value;
        if (liveUpdate) {
            update();
        }
    };

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(limitMaskStars_Control);
    this.sizer.add(maskStarRadiusMult_Control);
    this.sizer.add(maskStarRadiusAdd_Control);
    this.sizer.add(optionsSizer);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            this.sizer.spacing * 5 + this.sizer.margin * 2 +
            refCheckBox.height + limitMaskStars_Control.height * 3 + this.logicalPixelsToPhysical(20);
    this.resize(preferredWidth, preferredHeight);
    
    {
        // Scroll to center of join region
        let x = joinArea.center.x - bitmapOffset.x;
        let y = joinArea.center.y - bitmapOffset.y;
        previewControl.scrollbox.horizontalScrollPosition = Math.max(0, x - previewControl.width / 2);
        previewControl.scrollbox.verticalScrollPosition = Math.max(0, y - previewControl.height / 2);
    }
    
    setTitle();
}

// ----------------------------
// Star mask controls
// ----------------------------
function createLimitMaskStarsControl(dialog, data, labelLength){
    let limitMaskStars_Control = new NumericControl(dialog);
    limitMaskStars_Control.real = false;
    limitMaskStars_Control.label.text = "Limit stars %:";
    limitMaskStars_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to " +
            "create the star mask.</p>" +
            "<p>0% will produce a solid mask with no stars.<br />" +
            "100% will produce a mask that includes all detected stars.</p>" +
            "<p>Small faint stars are usually free of artifacts, so normally " +
            "only a small percentage of the detected stars need to be used.</p>";
    limitMaskStars_Control.label.setFixedWidth(labelLength);
    limitMaskStars_Control.setRange(0, 100);
    limitMaskStars_Control.slider.setRange(0, 100);
    limitMaskStars_Control.slider.minWidth = 200;
    limitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    return limitMaskStars_Control;
}

function createMaskStarRadiusMultControl(dialog, data, labelLength){
    let maskStarRadiusMult_Control = new NumericControl(dialog);
    maskStarRadiusMult_Control.real = true;
    maskStarRadiusMult_Control.label.text = "Multiply star radius:";
    maskStarRadiusMult_Control.toolTip =
            "<p>Increases the size of the brightest stars.</p>" +
            "<p>It mainly affects stars that are saturated or close to saturation.</p>";
    maskStarRadiusMult_Control.label.setFixedWidth(labelLength);
    maskStarRadiusMult_Control.setRange(1, 25);
    maskStarRadiusMult_Control.slider.setRange(1, 250);
    maskStarRadiusMult_Control.setPrecision(1);
    maskStarRadiusMult_Control.slider.minWidth = 250;
    maskStarRadiusMult_Control.setValue(data.maskStarRadiusMult);
    return maskStarRadiusMult_Control;
}

function createMaskStarRadiusAddControl(dialog, data, labelLength){
    let maskStarRadiusAdd_Control = new NumericControl(dialog);
    maskStarRadiusAdd_Control.real = true;
    maskStarRadiusAdd_Control.label.text = "Add to star radius:";
    maskStarRadiusAdd_Control.toolTip =
            "<p>Used to increases or decreases the radius of all mask stars.</p>" +
            "<p>This is applied after the 'Multiply star radius'.</p>";
    maskStarRadiusAdd_Control.label.setFixedWidth(labelLength);
    maskStarRadiusAdd_Control.setRange(0, 10);
    maskStarRadiusAdd_Control.slider.setRange(0, 100);
    maskStarRadiusAdd_Control.setPrecision(1);
    maskStarRadiusAdd_Control.slider.minWidth = 100;
    maskStarRadiusAdd_Control.setValue(data.maskStarRadiusAdd);
    return maskStarRadiusAdd_Control;
}

MaskStarsDialog.prototype = new Dialog;
