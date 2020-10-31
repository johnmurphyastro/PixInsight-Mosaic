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
    let drawPathFlag = true;
    let drawTargetSideFlag = true;
    
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
                let radius = calcSampleStarRejectionRadius(star, data);
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                graphics.strokeCircle(x, y, radius);
            }
            
            if (drawPathFlag){
                graphics.pen = new Pen(0xff00ff00, 2.0);
                for (let i=1; i < joinPath.length; i++){
                    let x = joinPath[i-1].x - bitmapOffset.x;
                    let x2 = joinPath[i].x - bitmapOffset.x;
                    let y = joinPath[i-1].y - bitmapOffset.y;
                    let y2 = joinPath[i].y - bitmapOffset.y;
                    graphics.drawLine(x, y, x2, y2);
                }
            }
            if (drawTargetSideFlag){
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
        self.enabled = false;
        processEvents();
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        updateSampleGrid();
        self.enabled = true;
    };
    
    let pathCheckBox = new CheckBox(this);
    pathCheckBox.text = "Display join path";
    pathCheckBox.toolTip = "<p>Displays the join path.</p>" +
            "<p>Where possible the join should avoid image corners, bright stars and star halos.</p>" +
            "<p>Use the 'Join Region (Advanced settings)' section " +
            "to change the position of the join</p>";
    pathCheckBox.checked = drawPathFlag;
    pathCheckBox.onClick = function (checked) {
        self.enabled = false;
        drawPathFlag = checked;
        processEvents();
        previewControl.forceRedraw();
        self.enabled = true;
    };
    
    let targetSideCheckBox = new CheckBox(this);
    targetSideCheckBox.text = "Display target side";
    targetSideCheckBox.toolTip = "<p>Indicates the target side of the overlapping pixels.</p>" +
            "<p>The overlap side of this boundary is fully corrected. " +
            "The Target side correction is extrapolated from the overlap data.</p>";
    targetSideCheckBox.checked = drawTargetSideFlag;
    targetSideCheckBox.onClick = function (checked) {
        self.enabled = false;
        drawTargetSideFlag = checked;
        processEvents();
        previewControl.forceRedraw();
        self.enabled = true;
    };
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(23);
    optionsSizer.add(pathCheckBox);
    optionsSizer.addSpacing(23);
    optionsSizer.add(targetSideCheckBox);
    optionsSizer.addStretch();
    
    controlsHeight += refCheckBox.height;
    
    // ===================================================
    // SectionBar: Sample rejection
    // ===================================================
    const labelLength = this.font.width("Growth Limit:");
    let limitSampleStarsPercent_Control = 
                createLimitSampleStarsPercentControl(this, data, labelLength);
    limitSampleStarsPercent_Control.maxWidth = 500;
    limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
        photometricMosaicDialog.limitSampleStarsPercent_Control.setValue(value);
        if (liveUpdate){
            updateSampleGrid();
        }
    };
    let filterGroupBox = new GroupBox(this);
    filterGroupBox.title = "Filter stars";
    filterGroupBox.sizer = new VerticalSizer();
    filterGroupBox.sizer.margin = 2;
    filterGroupBox.sizer.spacing = 2;
    filterGroupBox.sizer.add(limitSampleStarsPercent_Control);
    
    controlsHeight += limitSampleStarsPercent_Control.height;
    controlsHeight += filterGroupBox.height + filterGroupBox.sizer.margin * 2;
        
    let sampleStarGrowthRate_Control =
                createSampleStarGrowthRateControl(this, data, labelLength);
    sampleStarGrowthRate_Control.maxWidth = 800;
    sampleStarGrowthRate_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRate = value;
        photometricMosaicDialog.sampleStarGrowthRate_Control.setValue(value);
        if (liveUpdate){
            updateSampleGrid();
        }
    };
    let sampleStarGrowthLimit_Control = createSampleStarGrowthLimitControl(this, data, labelLength);
    sampleStarGrowthLimit_Control.maxWidth = 800;
    sampleStarGrowthLimit_Control.onValueUpdated = function (value) {
        data.sampleStarGrowthLimit = value;
        photometricMosaicDialog.sampleStarGrowthLimit_Control.setValue(value);
        if (liveUpdate){
            updateSampleGrid();
        }
    };
    let sampleStarAdd_Control = createSampleStarAddControl(this, data, labelLength);
    sampleStarAdd_Control.maxWidth = 300;
    sampleStarAdd_Control.onValueUpdated = function (value) {
        data.sampleStarRadiusAdd = value;
        photometricMosaicDialog.sampleStarAdd_Control.setValue(value);
        if (liveUpdate){
            updateSampleGrid();
        }
    };
    let rejectRadiusGroupBox = new GroupBox(this);
    rejectRadiusGroupBox.title = "Star rejection radius";
    rejectRadiusGroupBox.sizer = new VerticalSizer();
    rejectRadiusGroupBox.sizer.margin = 2;
    rejectRadiusGroupBox.sizer.spacing = 2;
    rejectRadiusGroupBox.sizer.add(sampleStarGrowthRate_Control);
    rejectRadiusGroupBox.sizer.add(sampleStarGrowthLimit_Control);
    rejectRadiusGroupBox.sizer.add(sampleStarAdd_Control);
    
    controlsHeight += sampleStarGrowthRate_Control.height + 
            sampleStarGrowthLimit_Control.height + 
            sampleStarAdd_Control.height + 
            rejectRadiusGroupBox.height + 
            rejectRadiusGroupBox.sizer.margin * 2 +
            rejectRadiusGroupBox.sizer.spacing * 2;
    
    let rejectSamplesSection = new Control(this);
    rejectSamplesSection.sizer = new VerticalSizer;
    rejectSamplesSection.sizer.spacing = 2;
    rejectSamplesSection.sizer.add(rejectRadiusGroupBox);
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
    let sampleSize_Control = createSampleSizeControl(this, data, maxSampleSize, labelLength);
    sampleSize_Control.maxWidth = 500;
    sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
        photometricMosaicDialog.sampleSize_Control.setValue(value);
        if (liveUpdate){
            updateSampleGrid();
        }
    };
    controlsHeight += sampleSize_Control.height;
    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new VerticalSizer;
    sampleGenerationSection.sizer.spacing = 2;
    sampleGenerationSection.sizer.add(sampleSize_Control);
    sampleGenerationSection.sizer.addSpacing(5);
    let sampleGenerationBar = new SectionBar(this, "Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = "Specifies generate samples settings";
    controlsHeight += sampleGenerationBar.height + 5;
    // SectionBar "Sample Rejection" End
    
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
    this.sizer.add(optionsSizer);
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
 
function createSampleStarGrowthRateControl(dialog, data, labelLength){
    let sampleStarGrowthRate_Control = new NumericControl(dialog);
    sampleStarGrowthRate_Control.real = true;
    sampleStarGrowthRate_Control.label.text = "Growth rate:";
    sampleStarGrowthRate_Control.label.minWidth = labelLength;
    sampleStarGrowthRate_Control.toolTip =
            "<p>Increase to reject more samples around saturated stars.</p>" +
            "<p>Read the Help sections on 'Join Region' to learn when these " +
            "samples should be rejected.</p>";
    sampleStarGrowthRate_Control.setPrecision(2);
    sampleStarGrowthRate_Control.setRange(0, 30);
    sampleStarGrowthRate_Control.slider.setRange(0, 300);
    sampleStarGrowthRate_Control.slider.minWidth = 301;
    sampleStarGrowthRate_Control.setValue(data.sampleStarGrowthRate);
    return sampleStarGrowthRate_Control;
}

function createSampleStarGrowthLimitControl(dialog, data, strLen){
    let sampleStarGrowthLimit_Control = new NumericControl(dialog);
    sampleStarGrowthLimit_Control.real = false;
    sampleStarGrowthLimit_Control.label.text = "Growth Limit:";
    sampleStarGrowthLimit_Control.label.minWidth = strLen;
    sampleStarGrowthLimit_Control.toolTip =
            "<p>Maximum star aperture growth.</p>" +
            "<p>Limits the aperture radius growth to this number of pixels.</p>";
    sampleStarGrowthLimit_Control.setRange(3, 300);
    sampleStarGrowthLimit_Control.slider.setRange(3, 300);
    sampleStarGrowthLimit_Control.slider.minWidth = 300;
    sampleStarGrowthLimit_Control.setValue(data.sampleStarGrowthLimit);
    return sampleStarGrowthLimit_Control;
}

function createSampleStarAddControl(dialog, data, strLen){
    let sampleStarAdd_Control = new NumericControl(dialog);
    sampleStarAdd_Control.real = false;
    sampleStarAdd_Control.label.text = "Radius add:";
    sampleStarAdd_Control.label.minWidth = strLen;
    sampleStarAdd_Control.toolTip =
            "<p>Minimum star aperture growth.</p>" +
            "<p>This value gets added to the aperture radius for all stars.</p>";
    sampleStarAdd_Control.setRange(0, 10);
    sampleStarAdd_Control.slider.setRange(0, 10);
    sampleStarAdd_Control.slider.minWidth = 50;
    sampleStarAdd_Control.setValue(data.sampleStarRadiusAdd);
    return sampleStarAdd_Control;
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
