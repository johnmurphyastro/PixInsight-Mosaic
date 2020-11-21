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
 * @param {Point[]} joinPath The path of the reference image - target image join
 * @param {Point[]} targetSide The target side envelope of the overlapping pixels
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function SampleGridDialog(title, refBitmap, tgtBitmap, sampleGridMap, detectedStars, data,
        maxSampleSize, joinPath, targetSide, photometricMosaicDialog)
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
    let drawOverlapRejectionFlag = true;
    let showGridFlag = true;
    
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
            
            if (showGridFlag){
                // Draw the sample grid
                for (let binRect of sampleGridMap.getBinRectArray(0)){
                    let rect = new Rect(binRect);
                    rect.translateBy(-bitmapOffset.x, -bitmapOffset.y);
                    graphics.drawRect(rect);
                }
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
            if (drawOverlapRejectionFlag){
                graphics.pen = new Pen(0xffff0000, 1.0);
            } else  {
                graphics.pen = new Pen(0xff0000ff, 1.0);
            }
            let growth = new SampleGrowthRateAndLimit(data, drawOverlapRejectionFlag);
            for (let i = 0; i < firstNstars; ++i){
                let star = stars[i];
                let radius = calcSampleStarRejectionRadius(star, data, growth.rate, growth.limit);
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                graphics.strokeCircle(x, y, radius);
            }
            
            graphics.antialiasing = false;
            if (drawOverlapRejectionFlag){
                graphics.pen = new Pen(0xff00ff00, 2.0);
                if (data.useMosaicOverlay && !data.useCropTargetToJoinRegion){
                    // Overlay mosaic mode. Draw join path
                    for (let i=1; i < joinPath.length; i++){
                        let x = joinPath[i-1].x - bitmapOffset.x;
                        let x2 = joinPath[i].x - bitmapOffset.x;
                        let y = joinPath[i-1].y - bitmapOffset.y;
                        let y2 = joinPath[i].y - bitmapOffset.y;
                        graphics.drawLine(x, y, x2, y2);
                    }
                } else {
                    // Random or Average mosaic mode. Draw Join Region rectangle
                    let joinRegion = new JoinRegion(data);
                    let joinRect = new Rect(joinRegion.joinRect);
                    joinRect.translateBy(-bitmapOffset.x, -bitmapOffset.y);
                    graphics.drawRect(joinRect);
                }
            } else {
                graphics.pen = new Pen(0xff0000ff, 2.0);
                for (let i=1; i < targetSide.length; i++){
                    let x = targetSide[i-1].x - bitmapOffset.x;
                    let x2 = targetSide[i].x - bitmapOffset.x;
                    let y = targetSide[i-1].y - bitmapOffset.y;
                    let y2 = targetSide[i].y - bitmapOffset.y;
                    graphics.drawLine(x, y, x2, y2);
                }
            }
            
        } catch (e) {
            console.criticalln("drawSampleGrid error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, 1800, 700, null, null, false);
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
    refCheckBox.toolTip = "Display either the reference or target background.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        previewControl.forceRedraw();
    };
    
    let joinSize_Control;
    let joinPosition_Control;
    let sampleStarGrowthRate_Control;
    let sampleStarGrowthLimit_Control;
    let sampleStarGrowthRateTarget_Control;
    let sampleStarGrowthLimitTarget_Control;
    let displayOverlapRejectionCheckBox = new CheckBox(this);
    displayOverlapRejectionCheckBox.text = "Overlap rejection";
    displayOverlapRejectionCheckBox.toolTip = "<p>Show the sample rejection for " +
            "either <b>overlap</b> correction or <b>target image</b> correction.</p>" +
            "<p><u>Overlap correction</u>:" +
            "<ul><li><b>Green line</b>: Join Path (reference to target transition). " +
            "Use 'Position (+/-)' to move the join to avoid bright stars and image corners.</li>" +
            "<li><b>Green rectangle</b>: Join Region bounding box. " +
            "Shown instead of the Join Path for 'Random' and 'Average' modes. " +
            "Mosaiced pixels within this area will be randomly chosen or averaged. " +
            "Use 'Join size' in the 'Join Region' section to set the rectangle thickness.</li>" +
            "<li><b>Red circles</b>: Star rejection circles. The brighter stars " +
            "should be completely within these circles. They do not need to include " +
            "filter halos or scattered light.</li></ul>" +
            "<p><u>Target image correction</u>:" +
            "<ul><li><b>Blue line</b>: this line indicates the target side of the " +
            "overlap region. This region determines the gradient correction that " +
            "will be applied to the target image.</li>" +
            "<li><b>Blue circles</b>: Star rejection circles. The brighter stars " +
            "should be completely within these circles. Aim to include their " +
            "filter halos and scattered light. This prevents local gradients " +
            "around bright stars affecting the gradient correction across the target image. " +
            "Rejecting local gradients is particularly important near the blue line.</li></ul>";
    displayOverlapRejectionCheckBox.checked = drawOverlapRejectionFlag;
    displayOverlapRejectionCheckBox.onClick = function (checked) {
        joinSize_Control.enabled = !data.useMosaicOverlay && !data.useCropTargetToJoinRegion && checked;
        joinPosition_Control.enabled = !data.useCropTargetToJoinRegion && checked;
        sampleStarGrowthRate_Control.enabled = !data.useAutoSampleGeneration && checked;
        sampleStarGrowthLimit_Control.enabled = !data.useAutoSampleGeneration && checked;
        sampleStarGrowthRateTarget_Control.enabled = !data.useAutoSampleGeneration && !checked;
        sampleStarGrowthLimitTarget_Control.enabled = !data.useAutoSampleGeneration && !checked;
        drawOverlapRejectionFlag = checked;
        finalUpdateFunction();
    };
    if (data.useCropTargetToJoinRegion){
        // Only the overlap - join region is used. The rest of the target image is 
        // not modified, so target image gradient correction is not used.
        displayOverlapRejectionCheckBox.checked = true;
        displayOverlapRejectionCheckBox.enabled = false;
    }
    
    let sampleControls = new SampleControls;
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     * @param {Number} value NumericControl's value
     */
    function finalUpdateFunction(value){
        self.enabled = false;
        processEvents();
        updateSampleGrid();
        self.enabled = true;
    }

    // ===================================================
    // SectionBar: Join Position
    // ===================================================
    /**
     * Force the joinPosition to update after the user edits the textbox directly.
     * @param {Number} value NumericControl's value
     */
    function finalJoinSizeUpdateFunction(value){
        self.enabled = false;
        processEvents();
        previewControl.forceRedraw();
        self.enabled = true;
        // If the join size has increased, the join position range must be reduced.
        // If data.joinPosition is out of range, it must be updated.
        setJoinPositionRange(joinPosition_Control, data, true);
        setJoinPositionRange(photometricMosaicDialog.joinPosition_Control, data, false);
        // Update the main dialog's join and position values
        // This had to be done after updating the ranges and data.joinPosition
        photometricMosaicDialog.joinSize_Control.setValue(value);
        photometricMosaicDialog.joinPosition_Control.setValue(data.joinPosition);
    }
    /**
     * Force the joinPosition to update after the user edits the textbox directly.
     * @param {Number} value NumericControl's value
     */
    function finalJoinPositionUpdateFunction(value){
        self.enabled = false;
        processEvents();
        previewControl.forceRedraw();
        self.enabled = true;
        // Update the main dialog's position value
        photometricMosaicDialog.joinPosition_Control.setValue(value);
    }
    
    joinSize_Control = sampleControls.createJoinSizeControl(this, data, 0);
    joinSize_Control.onValueUpdated = function (value) {
        data.joinSize = value;
        let joinRegion = new JoinRegion(data);
        // Update data.joinPosition. Necessary if the joinSize has increased
        joinRegion.updateJoinPosition();
        // Update the join position control.
        // The main dialog's control will be update at the end of the drag
        joinPosition_Control.setValue(data.joinPosition);
        // Draw the rectangle, and update the target view's JoinRegion preview
        previewControl.forceRedraw();
        joinRegion.createPreview(data.targetView);
    };
    addFinalUpdateListener(joinSize_Control, finalJoinSizeUpdateFunction);
    joinSize_Control.enabled = 
            !data.useMosaicOverlay &&
            !data.useCropTargetToJoinRegion && 
            displayOverlapRejectionCheckBox.checked;
    
    joinPosition_Control = sampleControls.createJoinPositionControl(this, data, 0);
    joinPosition_Control.onValueUpdated = function (value) {
        data.joinPosition = value;
        let joinRegion = new JoinRegion(data);
        let joinRect = joinRegion.joinRect;
        let isHorizontal = joinRegion.isJoinHorizontal();
        joinPath = createMidJoinPathLimittedByOverlap(data.targetView.image,
                data.cache.overlap, joinRect, isHorizontal, data);
        previewControl.forceRedraw();
        joinRegion.createPreview(data.targetView);
    };
    addFinalUpdateListener(joinPosition_Control, finalJoinPositionUpdateFunction);
    joinPosition_Control.enabled = !data.useCropTargetToJoinRegion && displayOverlapRejectionCheckBox.checked;
    
    let joinPositionSection = new Control(this);
    joinPositionSection.sizer = new VerticalSizer;
    joinPositionSection.sizer.add(joinSize_Control);
    joinPositionSection.sizer.add(joinPosition_Control);
    let joinPositionBar = new SectionBar(this, "Join");
    joinPositionBar.setSection(joinPositionSection);
    joinPositionBar.onToggleSection = this.onToggleSection;
    joinPositionBar.toolTip = "Shifts join position";
    controlsHeight += joinPositionBar.height + 5;
    if (!joinPosition_Control.enabled){
        joinPositionSection.hide();
    } else {
        controlsHeight += joinSize_Control.height;
        controlsHeight += joinPosition_Control.height;
    }
    
    // ===================================================
    // SectionBar: Sample rejection
    // ===================================================
    const labelLength = this.font.width(sampleControls.growthLimit.text);
    
    let limitSampleStarsPercent_Control = 
                sampleControls.createLimitSampleStarsPercentControl(this, data, 0);
    limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
        photometricMosaicDialog.limitSampleStarsPercent_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(limitSampleStarsPercent_Control, finalUpdateFunction);
    
    let filterGroupBox = new GroupBox(this);
    filterGroupBox.title = "Filter stars";
    filterGroupBox.sizer = new VerticalSizer();
    filterGroupBox.sizer.margin = 2;
    filterGroupBox.sizer.spacing = 2;
    filterGroupBox.sizer.add(limitSampleStarsPercent_Control);
    
    controlsHeight += limitSampleStarsPercent_Control.height;
    controlsHeight += filterGroupBox.height + filterGroupBox.sizer.margin * 2;
        
    sampleStarGrowthRate_Control =
                sampleControls.createSampleStarGrowthRateControl(this, data, labelLength);
    sampleStarGrowthRate_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRate = value;
        photometricMosaicDialog.sampleStarGrowthRate_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(sampleStarGrowthRate_Control, finalUpdateFunction);
    sampleStarGrowthRate_Control.enabled = !data.useAutoSampleGeneration;
    
    sampleStarGrowthLimit_Control = 
            sampleControls.createSampleStarGrowthLimitControl(this, data, labelLength);
    sampleStarGrowthLimit_Control.onValueUpdated = function (value) {
        data.sampleStarGrowthLimit = value;
        photometricMosaicDialog.sampleStarGrowthLimit_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(sampleStarGrowthLimit_Control, finalUpdateFunction);
    sampleStarGrowthLimit_Control.enabled = !data.useAutoSampleGeneration && displayOverlapRejectionCheckBox.checked;
    
    sampleStarGrowthLimitTarget_Control = 
            sampleControls.createSampleStarGrowthLimitTargetControl(this, data, labelLength);
    sampleStarGrowthLimitTarget_Control.onValueUpdated = function (value) {
        data.sampleStarGrowthLimitTarget = value;
        photometricMosaicDialog.sampleStarGrowthLimitTarget_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(sampleStarGrowthLimitTarget_Control, finalUpdateFunction);
    sampleStarGrowthLimitTarget_Control.enabled = !data.useAutoSampleGeneration && !displayOverlapRejectionCheckBox.checked;
    
    sampleStarGrowthRateTarget_Control =
            sampleControls.createSampleStarGrowthRateTargetControl(this, data, labelLength);
    sampleStarGrowthRateTarget_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRateTarget = value;
        photometricMosaicDialog.sampleStarGrowthRateTarget_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(sampleStarGrowthRateTarget_Control, finalUpdateFunction);
    sampleStarGrowthRateTarget_Control.enabled = !data.useAutoSampleGeneration && !displayOverlapRejectionCheckBox.checked;
    
    let rejectRadiusGroupBox = new GroupBox(this);
    rejectRadiusGroupBox.title = "Overlap star rejection radius";
    rejectRadiusGroupBox.sizer = new VerticalSizer();
    rejectRadiusGroupBox.sizer.margin = 2;
    rejectRadiusGroupBox.sizer.spacing = 2;
    rejectRadiusGroupBox.sizer.add(sampleStarGrowthRate_Control);
    rejectRadiusGroupBox.sizer.add(sampleStarGrowthLimit_Control);
    
    let rejectRadiusTargetGroupBox = new GroupBox(this);
    rejectRadiusTargetGroupBox.title = "Target star rejection radius";
    rejectRadiusTargetGroupBox.sizer = new VerticalSizer();
    rejectRadiusTargetGroupBox.sizer.margin = 2;
    rejectRadiusTargetGroupBox.sizer.spacing = 2;
    rejectRadiusTargetGroupBox.sizer.add(sampleStarGrowthRateTarget_Control);
    rejectRadiusTargetGroupBox.sizer.add(sampleStarGrowthLimitTarget_Control);
    
    controlsHeight += sampleStarGrowthRate_Control.height + 
            sampleStarGrowthRateTarget_Control.height +
            sampleStarGrowthLimit_Control.height + 
            sampleStarGrowthLimitTarget_Control.height + 
            rejectRadiusGroupBox.height + 
            rejectRadiusTargetGroupBox.height + 
            rejectRadiusGroupBox.sizer.margin * 2 +
            rejectRadiusGroupBox.sizer.spacing * 2;
    
    let rejectSamplesSection = new Control(this);
    rejectSamplesSection.sizer = new VerticalSizer;
    rejectSamplesSection.sizer.spacing = 2;
    rejectSamplesSection.sizer.add(rejectRadiusGroupBox);
    rejectSamplesSection.sizer.add(rejectRadiusTargetGroupBox);
    rejectSamplesSection.sizer.add(filterGroupBox);
    let rejectSamplesBar = new SectionBar(this, "Sample Rejection");
    rejectSamplesBar.setSection(rejectSamplesSection);
    rejectSamplesBar.onToggleSection = this.onToggleSection;
    rejectSamplesBar.toolTip = "Reject samples that are too close to bright stars";
    controlsHeight += rejectSamplesBar.height + 2;
    // SectionBar "Sample Rejection" End

    // ===================================================
    // SectionBar: Sample Generation
    // ===================================================
    let sampleSize_Control = sampleControls.createSampleSizeControl(
            this, data, maxSampleSize, 0);
    sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
        photometricMosaicDialog.sampleSize_Control.setValue(value);
    };
    addFinalUpdateListener(sampleSize_Control, finalUpdateFunction);
    
    sampleSize_Control.enabled = !data.useAutoSampleGeneration;
    controlsHeight += sampleSize_Control.height;
    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new VerticalSizer;
    sampleGenerationSection.sizer.add(sampleSize_Control);
    let sampleGenerationBar = new SectionBar(this, "Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = "Specifies generate samples settings";
    controlsHeight += sampleGenerationBar.height;
    // SectionBar "Sample Rejection" End
    
    /**
     * Create a new SampleGridMap from the updated parameters, and draw it 
     * on top of the background bitmap within the scrolled window.
     */
    function updateSampleGrid(){
        sampleGridMap = data.cache.getSampleGridMap(detectedStars.allStars, data, 
                drawOverlapRejectionFlag);
        previewControl.forceRedraw();
    }
    
    let autoCheckBox = new CheckBox(this);
    autoCheckBox.text = "Auto";
    autoCheckBox.toolTip = "<p>Calculates default values for the following parameters:</p>" +
            "<ul><li><b>Radius add</b> - set to 'Radius add' from Photometry section.</li>" +
            "<li><b>Growth rate</b> - set to 'Growth rate' from Photometry section.</li>" +
            "<li><b>Growth Limit (Overlap)</b> - calculated from ImageSolver header 'CDELT1'</li>" +
            "<li><b>Growth Limit (Target)</b> - calculated from ImageSolver header 'CDELT1'</li>" +
            "<li><b>Sample size</b> - calculated from ImageSolver headers 'XPIXSZ' and 'CDELT1'</li>" +
            "</ul>";
    autoCheckBox.onClick = function (checked) {
        photometricMosaicDialog.setSampleGenerationAutoValues(checked);
        if (checked){
            self.enabled = false;
            sampleStarGrowthRate_Control.setValue(data.sampleStarGrowthRate);
            sampleStarGrowthLimit_Control.setValue(data.sampleStarGrowthLimit);
            sampleStarGrowthRateTarget_Control.setValue(data.sampleStarGrowthRateTarget);
            sampleStarGrowthLimitTarget_Control.setValue(data.sampleStarGrowthLimitTarget);
            sampleSize_Control.setValue(data.sampleSize);
            processEvents();
            updateSampleGrid();
            self.enabled = true;
        }
        sampleStarGrowthRate_Control.enabled = !checked && displayOverlapRejectionCheckBox.checked;
        sampleStarGrowthLimit_Control.enabled = !checked && displayOverlapRejectionCheckBox.checked;
        sampleStarGrowthRateTarget_Control.enabled = !checked && !displayOverlapRejectionCheckBox.checked;
        sampleStarGrowthLimitTarget_Control.enabled = !checked && !displayOverlapRejectionCheckBox.checked;
        sampleSize_Control.enabled = !checked && showGridFlag;
    };
    autoCheckBox.checked = data.useAutoSampleGeneration;
    
    let gridCheckBox = new CheckBox(this);
    gridCheckBox.text = "Grid";
    gridCheckBox.toolTip = "Show / hide sample grid.";
    gridCheckBox.checked = true;
    gridCheckBox.onClick = function (checked) {
        showGridFlag = checked;
        previewControl.forceRedraw();
        sampleSize_Control.enabled = !autoCheckBox.checked && showGridFlag;
    };
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(autoCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(gridCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(displayOverlapRejectionCheckBox);
    optionsSizer.addStretch();
    
    controlsHeight += refCheckBox.height;

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(joinPositionBar);
    this.sizer.add(joinPositionSection);
    this.sizer.add(rejectSamplesBar);
    this.sizer.add(rejectSamplesSection);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(previewControl.getButtonSizer());

    controlsHeight += this.sizer.spacing * 6 + this.sizer.margin * 2;

    // The PreviewControl size is determined by the size of the bitmap
    // The dialog must also leave enough room for the extra controls we are adding
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            controlsHeight + this.logicalPixelsToPhysical(20);
    this.resize(preferredWidth, preferredHeight);
    setTitle();
}

SampleGridDialog.prototype = new Dialog;
