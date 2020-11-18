/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow, StdCursor_Checkmark, PhotometryControls */

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
 * Display the detected stars in a Dialog that contains a scrolled window.
 * The user can choose to display stars from the reference image or the target image.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {Bitmap} tgtBitmap Background image of the target overlap area at 1:1 scale
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function DetectedStarsDialog(title, refBitmap, tgtBitmap, detectedStars, data, photometricMosaicDialog)
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
    let stars = getStars(selectedBitmap, selectedChannel);
    let nChannels = detectedStars.refColorStars.length;
    let colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
    let starPairs = getStarPairs(selectedChannel);
    
    let fastDraw = false;
    let drawOrigPhotRects = false;
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? refBitmap : tgtBitmap;
    }
    
    /**
     * Display the stars detected in the reference (refOrTgt = REF) or target image.
     * The displayed stars can be limited to a single color channel.
     * @param {NUMBER} refOrTgt Set to REF or TGT
     * @param {Number} channel Only display stars from this channel. If channel = 3,
     * show all stars in the image (reference image or target image)
     * @returns {Star[]}
     */
    function getStars(refOrTgt, channel){
        let colorStars = refOrTgt === REF ? detectedStars.refColorStars : detectedStars.tgtColorStars;
        stars = [];
        if (channel < colorStars.length){
            stars = colorStars[channel];
        } else if (colorStars.length === 3){
            stars = colorStars[0].concat(colorStars[1], colorStars[2]);
        } else {
            stars = colorStars[0];
        }
        return stars;
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
    function drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000, 1.0);
            graphics.antialiasing = true;
            for (let i = 0; i < stars.length; ++i){
                let star = stars[i];
                let radius = star.getStarRadius();
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                graphics.strokeCircle(x, y, radius);
            }
        } catch (e){
            console.criticalln("drawDetectedStars error: " + e);
        } finally {
            graphics.end();
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
     * @param {PhotometricMosaicData} data Values from user interface
     */
    function drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1, data){
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
                let rect;
                if (fastDraw){
                    if (selectedBitmap === REF){
                        rect = starPair.getRefAperture(data.apertureAdd, 
                                data.apertureGrowthRate, data.apertureGrowthLimit);
                    } else {
                        rect = starPair.getTgtAperture(data.apertureAdd, 
                                data.apertureGrowthRate, data.apertureGrowthLimit);
                    }
                } else {
                    let tgtStar = starPair.tgtStar;
                    let refStar = starPair.refStar;               
                    if (selectedBitmap === REF){
                        if (drawOrigPhotRects){
                            rect = new Rect(refStar.getBoundingBox());
                        } else {
                            rect = new Rect(refStar.getStarAperture());
                        }
                    } else {
                        if (drawOrigPhotRects){
                            rect = new Rect(tgtStar.getBoundingBox());
                        } else {
                            rect = new Rect(tgtStar.getStarAperture());
                        }
                    }
                }
                rect.moveBy(-bitmapOffset.x, -bitmapOffset.y);
                graphics.strokeRect(rect);
                let bg = rect.inflatedBy( data.apertureBgDelta );
                graphics.strokeRect(bg);
            }
        } catch(e) {
            console.criticalln("drawPhotometryStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, 1800, 850, null, null, false);
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
        if (photometricCheckBox.checked){
            drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1, data);
        } else {
            drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
        }
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
    refCheckBox.toolTip = "Display either reference background and stars, or " +
            "target background and stars.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let photometricCheckBox = new CheckBox(this);
    photometricCheckBox.text = "Photometry";
    photometricCheckBox.toolTip = "<p>Display either the detected stars (circles) " +
            "or the stars used for photometry (square aperture rings).</p>";
    photometricCheckBox.checked = true;
    photometricCheckBox.onClick = function (checked) {
        enableControls(data.useAutoPhotometry, checked);
        starPairs = getStarPairs(selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let oldPhotometricCheckBox;
    if (EXTRA_CONTROLS()){
        oldPhotometricCheckBox = new CheckBox(this);
        oldPhotometricCheckBox.text = "Unmodified";
        oldPhotometricCheckBox.toolTip = "<p>Use photometry rectangles from StarDetector.</p>";
        oldPhotometricCheckBox.checked = drawOrigPhotRects;
        oldPhotometricCheckBox.onClick = function (checked) {
            drawOrigPhotRects = checked;
            starPairs = getStarPairs(selectedChannel);
            previewControl.updateBitmap(bitmap);
            update();
        };
    }
    
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "<p>Display the stars detected within the red channel</p>" +
            "<p>This is only used to declutter the display. " +
            "The settings will be applied to all color channels.</p>";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel = 0;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "<p>Display the stars detected within the green channel</p>" +
            "<p>This is only used to declutter the display. " +
            "The settings will be applied to all color channels.</p>";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel = 1;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "<p>Display the stars detected within the blue channel</p>" +
            "<p>This is only used to declutter the display. " +
            "The settings will be applied to all color channels.</p>";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel = 2;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the stars detected within all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel = 3;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    if (detectedStars.refColorStars.length === 1){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     * @param {Number} value NumericControl's value
     */
    function finalUpdateFunction(value){
        self.enabled = false;
        processEvents();
        fastDraw = false;
        updatePhotometry();
        self.enabled = true;
    }
    
    // ===================================================
    // SectionBar: Star aperture size
    // ===================================================
    let photometryControls = new PhotometryControls();
    let strLen = this.font.width("Background delta:");
    
    let apertureGrowthRate_Control = photometryControls.createApertureGrowthRateControl(
            this, data, strLen);
    apertureGrowthRate_Control.onValueUpdated = function (value) {
        data.apertureGrowthRate = value;
        photometricMosaicDialog.apertureGrowthRate_Control.setValue(value);
        photometricMosaicDialog.setSampleStarGrowthRateAutoValue();
        photometricMosaicDialog.setSampleStarGrowthRateTargetAutoValue();
        fastDraw = true;
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureGrowthRate_Control, finalUpdateFunction);
    controlsHeight += apertureGrowthRate_Control.height;
    
    let apertureAdd_Control = photometryControls.createApertureAddControl(this, data, strLen);
    apertureAdd_Control.onValueUpdated = function (value) {
        data.apertureAdd = value;
        photometricMosaicDialog.apertureAdd_Control.setValue(value);
        fastDraw = true;
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureAdd_Control, finalUpdateFunction);
    controlsHeight += apertureAdd_Control.height;
    
    let apertureBgDelta_Control = photometryControls.createApertureBgDeltaControl(
            this, data, strLen);
    apertureBgDelta_Control.onValueUpdated = function (value) {
        data.apertureBgDelta = value;
        photometricMosaicDialog.apertureBgDelta_Control.setValue(value);
        fastDraw = true;
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureBgDelta_Control, finalUpdateFunction);
    controlsHeight += apertureBgDelta_Control.height;
    
    let apertureSection = new Control(this);
    apertureSection.sizer = new VerticalSizer;
    apertureSection.sizer.spacing = 2;
    apertureSection.sizer.add(apertureAdd_Control);
    apertureSection.sizer.add(apertureGrowthRate_Control);
    if (EXTRA_CONTROLS()){
        let apertureGrowthLimit_Control = photometryControls.createApertureGrowthLimitControl(
                this, data, strLen);
        apertureGrowthLimit_Control.onValueUpdated = function (value) {
            data.apertureGrowthLimit = value;
            photometricMosaicDialog.apertureGrowthLimit_Control.setValue(value);
            fastDraw = true;
            update();
            processEvents();
        };
        addFinalUpdateListener(apertureGrowthLimit_Control, finalUpdateFunction);
        controlsHeight += apertureGrowthLimit_Control.height;
        apertureSection.sizer.add(apertureGrowthLimit_Control);
    }
    apertureSection.sizer.add(apertureBgDelta_Control);
    let apertureBar = new SectionBar(this, "Star Aperture Size");
    apertureBar.setSection(apertureSection);
    apertureBar.onToggleSection = this.onToggleSection;
    apertureBar.toolTip = "Specifies the photometry star aperture";
    controlsHeight += apertureBar.height + apertureSection.sizer.spacing * 3;
    
    // ===================================================
    // SectionBar: Star filters
    // ===================================================
    const BACKGROUND_DELTA_STRLEN = this.font.width("Background delta:");
    
    let limitPhotoStarsPercent_Control = photometryControls.createLimitPhotoStarsPercentControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    limitPhotoStarsPercent_Control.onValueUpdated = function (value) {
        data.limitPhotoStarsPercent = value;
        photometricMosaicDialog.limitPhotoStarsPercent_Control.setValue(value);
    };
    addFinalUpdateListener(limitPhotoStarsPercent_Control, finalUpdateFunction);
//    controlsHeight += limitPhotoStarsPercent_Control.height;
    
    let linearRange_Control = photometryControls.createLinearRangeControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    linearRange_Control.onValueUpdated = function (value) {
        data.linearRange = value;
        photometricMosaicDialog.linearRange_Control.setValue(value);
    };
    addFinalUpdateListener(linearRange_Control, finalUpdateFunction);
//    controlsHeight += linearRange_Control.height;
    
    let outlierRemoval_Control = photometryControls.createOutlierRemovalControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
        photometricMosaicDialog.outlierRemoval_Control.setValue(value);
    };
    addFinalUpdateListener(outlierRemoval_Control, finalUpdateFunction);
//    controlsHeight += outlierRemoval_Control.height;
    
    let filterSection = new Control(this);
    filterSection.sizer = new VerticalSizer;
    filterSection.sizer.spacing = 2;
    filterSection.sizer.add(limitPhotoStarsPercent_Control);
    filterSection.sizer.add(linearRange_Control);
    filterSection.sizer.add(outlierRemoval_Control);
    filterSection.sizer.addSpacing(5);
    let filterBar = new SectionBar(this, "Filter Photometry Stars");
    filterBar.setSection(filterSection);
    filterBar.onToggleSection = this.onToggleSection;
    filterBar.toolTip = "Specifies which stars are used for photometry";
    controlsHeight += filterBar.height + filterSection.sizer.spacing * 2 + 5;

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }
    
    function updatePhotometry(){
        detectedStars.showConsoleInfo = false;
        colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
        starPairs = getStarPairs(selectedChannel);
        update();
        detectedStars.showConsoleInfo = true;
    }
    
    let autoCheckBox = new CheckBox(this);
    autoCheckBox.text = "Auto";
    autoCheckBox.toolTip = "<p>Automatically sets the following controls:</p>" +
            "<ul><li><b>Radius add</b></li>" +
            "<li><b>Growth rate</b></li>" +
            "<li><b>Background delta</b></li>" +
            "<li><b>Limit stars %</b></li>" +
            "<li><b>Linear range</b></li>" +
            "</ul>";
    autoCheckBox.onClick = function (checked) {
        photometricMosaicDialog.setPhotometryAutoValues(checked);
        if (checked){
            self.enabled = false;
            apertureAdd_Control.setValue(data.apertureAdd);
            apertureGrowthRate_Control.setValue(data.apertureGrowthRate);
            apertureBgDelta_Control.setValue(data.apertureBgDelta);
            limitPhotoStarsPercent_Control.setValue(data.limitPhotoStarsPercent);
            linearRange_Control.setValue(data.linearRange);
            processEvents();
            update();
            self.enabled = true;
        }
        enableControls(checked, photometricCheckBox.checked);
    };
    autoCheckBox.checked = data.useAutoPhotometry;
    
    function enableControls(auto, isPhotometricMode){
        apertureAdd_Control.enabled = !auto && isPhotometricMode;
        apertureGrowthRate_Control.enabled = !auto && isPhotometricMode;
        apertureBgDelta_Control.enabled = !auto && isPhotometricMode;
        limitPhotoStarsPercent_Control.enabled = !auto && isPhotometricMode;
        linearRange_Control.enabled = !auto && isPhotometricMode;
        outlierRemoval_Control.enabled = isPhotometricMode;
    }
    
    enableControls(data.useAutoPhotometry, true);

    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(autoCheckBox);
    optionsSizer.add(photometricCheckBox);
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(10);
    optionsSizer.add(redRadioButton);
    optionsSizer.add(greenRadioButton);
    optionsSizer.add(blueRadioButton);
    optionsSizer.add(allRadioButton);
    optionsSizer.addStretch();
    if (EXTRA_CONTROLS())
        optionsSizer.add(oldPhotometricCheckBox);
    
    controlsHeight += refCheckBox.height;
    
    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(apertureBar);
    this.sizer.add(apertureSection);
    this.sizer.add(filterBar);
    this.sizer.add(filterSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 4;
    filterSection.hide();

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            controlsHeight + this.logicalPixelsToPhysical(20);
    this.resize(preferredWidth, preferredHeight);
    setTitle();
}

DetectedStarsDialog.prototype = new Dialog;
