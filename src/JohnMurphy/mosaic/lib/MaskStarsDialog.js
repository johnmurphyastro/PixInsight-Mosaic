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
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {SamplePair[][]} binnedColorSamplePairs 
 * @param {Boolean} isHorizontal 
 * @param {Boolean} isTargetAfterRef 
 * @param {LinearFitData[]} scaleFactors 
 * @returns {SampleGridDialog}
 */
function MaskStarsDialog(joinArea, detectedStars, data, 
    binnedColorSamplePairs, isHorizontal, isTargetAfterRef, scaleFactors)
{
    this.__base__ = Dialog;
    this.__base__();
    
    const REF = 10;
    const TGT = 20;
    let self = this;
    
    let refView = data.referenceView;
    let tgtView = data.targetView;
    
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
        self.windowTitle = "Create Star Mask " + zoomText + " " + coordText;
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
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                let starRadius = calcStarMaskRadius(star, data);
                graphics.strokeCircle(x, y, starRadius);
            }
        } catch (e) {
            console.criticalln("drawMaskStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    function createCorrectedTarget(data, joinArea, binnedColorSamplePairs,
            isHorizontal, isTargetAfterRef, scaleFactors)
    {
        let propagateSurfaceSplines = 
                getSurfaceSplines(data, binnedColorSamplePairs, data.targetGradientSmoothness, 3);
        let surfaceSplines = 
                getSurfaceSplines(data, binnedColorSamplePairs, data.overlapGradientSmoothness, 3);
        
        let imageWindow = createCorrectedView(isHorizontal, isTargetAfterRef, 
                scaleFactors, propagateSurfaceSplines, surfaceSplines, false, joinArea, data);
        imageWindow.show();
        imageWindow.zoomToFit();
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
                update();
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
            update();
            self.enabled = true;
        };
        update_Button.enabled = !liveUpdate_control.checked;
        
        let correctTarget_Button = new PushButton(self);
        correctTarget_Button.text = "Correct target";
        correctTarget_Button.setFixedWidth();
        correctTarget_Button.toolTip = "<p>Create a corrected target image.</p>" +
                "<p>The unedited reference image can be used to replace stars in a masked mosaic, " +
                "but if you wish to use the target image instead, " +
                "it must first be corrected (scale and gradient) before it " +
                "can be used.</p>" +
                "<p>This option creates a corrected target image " +
                "that can be used with the star mask.</p>";
        correctTarget_Button.onClick = function () {
            console.writeln("\n<b><u>Creating corrected target image</u></b>");
            self.enabled = false;
            processEvents();
            createCorrectedTarget(data, joinArea, binnedColorSamplePairs,
                    isHorizontal, isTargetAfterRef, scaleFactors);
            self.enabled = true;
        };
        
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(liveUpdate_control);
        horizontalSizer.addSpacing(6);
        horizontalSizer.add(update_Button);
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(correctTarget_Button);
        horizontalSizer.addSpacing(10);
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null, customControls, true);
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

    previewControl.ok_Button.toolTip = "<p>Create new mask image</p>";
    previewControl.ok_Button.onClick = function(){
        console.writeln("\n<b><u>Creating mosaic mask</u></b>");
        self.enabled = false;
        processEvents();
        createStarMask(tgtView, joinArea, detectedStars, data);    
        self.enabled = true;
    };
    
    previewControl.cancel_Button.toolTip = "<p>Close dialog</p>";
    previewControl.cancel_Button.onClick = function(){
        self.ok();
    };

    previewControl.setMinHeight(200);
    // ========================================
    // User controls
    // ========================================
    let controlsHeight = 0;
    let minHeight = previewControl.minHeight;
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            if (bar.isExpanded()){
                previewControl.setMinHeight(previewControl.height + bar.section.height + 2);
            } else {
                previewControl.setMinHeight(previewControl.height - bar.section.height - 2);
            }
        } else {
            previewControl.setMinHeight(minHeight);
        }
    };
    
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display reference or target image.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        update();
        self.enabled = true;
    };

    // ===================================================
    // SectionBar: Star size
    // ===================================================
    let starMaskLabelSize = this.font.width("Limit stars %:");
    let maskStarGrowthRate_Control = new NumericControl(this);
    maskStarGrowthRate_Control.real = true;
    maskStarGrowthRate_Control.label.text = "Growth rate:";
    maskStarGrowthRate_Control.toolTip =
            "<p>Increases the size of the brightest stars.</p>" +
            "<p>It mainly affects stars that are saturated or close to saturation.</p>";
    maskStarGrowthRate_Control.label.setFixedWidth(starMaskLabelSize);
    maskStarGrowthRate_Control.setRange(0, 30);
    maskStarGrowthRate_Control.slider.setRange(0, 300);
    maskStarGrowthRate_Control.setPrecision(2);
    maskStarGrowthRate_Control.maxWidth = 800;
    maskStarGrowthRate_Control.setValue(data.maskStarGrowthRate);
    maskStarGrowthRate_Control.onValueUpdated = function (value) {
        data.maskStarGrowthRate = value;
        if (liveUpdate) {
            update();
        }
    };
    controlsHeight += maskStarGrowthRate_Control.height;
    let maskStarGrowthLimit_Control = new NumericControl(this);
    maskStarGrowthLimit_Control.real = false;
    maskStarGrowthLimit_Control.label.text = "Growth Limit:";
    maskStarGrowthLimit_Control.label.setFixedWidth(starMaskLabelSize);
    maskStarGrowthLimit_Control.toolTip =
            "<p>Maximum star growth.</p>" +
            "<p>Limits the radius growth to this number of pixels.</p>";
    maskStarGrowthLimit_Control.setRange(3, 300);
    maskStarGrowthLimit_Control.slider.setRange(3, 300);
    maskStarGrowthLimit_Control.maxWidth = 800;
    maskStarGrowthLimit_Control.onValueUpdated = function (value) {
        data.maskStarGrowthLimit = value;
        if (liveUpdate) {
            update();
        }
    };
    controlsHeight += maskStarGrowthLimit_Control.height;
    let maskStarRadiusAdd_Control = new NumericControl(this);
    maskStarRadiusAdd_Control.real = true;
    maskStarRadiusAdd_Control.label.text = "Radius add:";
    maskStarRadiusAdd_Control.toolTip =
            "<p>Used to increases or decreases the radius of all mask stars.</p>" +
            "<p>This is applied after the 'Multiply star radius'.</p>";
    maskStarRadiusAdd_Control.label.setFixedWidth(starMaskLabelSize);
    maskStarRadiusAdd_Control.setRange(0, 30);
    maskStarRadiusAdd_Control.slider.setRange(0, 300);
    maskStarRadiusAdd_Control.setPrecision(1);
    maskStarRadiusAdd_Control.maxWidth = 800;
    maskStarRadiusAdd_Control.onValueUpdated = function (value) {
        data.maskStarRadiusAdd = value;
        if (liveUpdate) {
            update();
        }
    };
    controlsHeight += maskStarRadiusAdd_Control.height;
    
    let apertureSection = new Control(this);
    apertureSection.sizer = new VerticalSizer;
    apertureSection.sizer.spacing = 2;
    apertureSection.sizer.add(maskStarGrowthRate_Control);
    apertureSection.sizer.add(maskStarGrowthLimit_Control);
    apertureSection.sizer.add(maskStarRadiusAdd_Control);
    let apertureBar = new SectionBar(this, "Star Size");
    apertureBar.setSection(apertureSection);
    apertureBar.onToggleSection = this.onToggleSection;
    apertureBar.toolTip = "Specifies star size";
    controlsHeight += apertureBar.height + apertureSection.sizer.spacing * 2;
    
    // ===================================================
    // SectionBar: Star filters
    // ===================================================
    let limitMaskStars_Control = new NumericControl(this);
    limitMaskStars_Control.real = false;
    limitMaskStars_Control.label.text = "Limit stars %:";
    limitMaskStars_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to " +
            "create the star mask.</p>" +
            "<p>0% will produce a solid mask with no stars.<br />" +
            "100% will produce a mask that includes all detected stars.</p>" +
            "<p>Small faint stars are usually free of artifacts, so normally " +
            "only a small percentage of the detected stars need to be used.</p>";
    limitMaskStars_Control.label.setFixedWidth(starMaskLabelSize);
    limitMaskStars_Control.setRange(0, 100);
    limitMaskStars_Control.slider.setRange(0, 100);
    limitMaskStars_Control.maxWidth = 300;
    limitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    limitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
        if (liveUpdate) {
            update();
        }
    };
    controlsHeight += limitMaskStars_Control.height;
    
    let filterSection = new Control(this);
    filterSection.sizer = new VerticalSizer;
    filterSection.sizer.spacing = 2;
    filterSection.sizer.add(limitMaskStars_Control);
    filterSection.sizer.addSpacing(5);
    let filterBar = new SectionBar(this, "Filter Stars");
    filterBar.setSection(filterSection);
    filterBar.onToggleSection = this.onToggleSection;
    filterBar.toolTip = "Specifies which stars to unmask";
    controlsHeight += filterBar.height + 5;
    
    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }
    
    function setAutoValues(){
        if (data.isAutoMaskStar){
            data.maskStarGrowthRate = data.apertureGrowthRate;
            data.maskStarRadiusAdd = data.apertureAdd + 3;
        }
        maskStarGrowthRate_Control.setValue(data.maskStarGrowthRate);
        maskStarRadiusAdd_Control.setValue(data.maskStarRadiusAdd);
        maskStarGrowthRate_Control.enabled = !data.isAutoMaskStar;
        maskStarRadiusAdd_Control.enabled = !data.isAutoMaskStar;
    }
    let autoCheckBox = new CheckBox(this);
    autoCheckBox.text = "Auto";
    autoCheckBox.toolTip = "Use calculated values for some fields";
    autoCheckBox.onClick = function (checked) {
        data.isAutoMaskStar = checked;
        setAutoValues();
        update();
    };
    autoCheckBox.checked = data.isAutoMaskStar;
    setAutoValues();
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(autoCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();
    
    controlsHeight += refCheckBox.height;

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 4;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(apertureBar);
    this.sizer.add(apertureSection);
    this.sizer.add(filterBar);
    this.sizer.add(filterSection);
    this.sizer.add(previewControl.getButtonSizer());

    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 6;

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            controlsHeight + this.logicalPixelsToPhysical(20);
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

MaskStarsDialog.prototype = new Dialog;
