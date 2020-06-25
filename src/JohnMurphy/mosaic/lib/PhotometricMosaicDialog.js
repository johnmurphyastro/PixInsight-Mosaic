/* global ImageWindow, Parameters, View, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok, Dialog, StdButton_Yes, StdIcon_Question, StdButton_No, StdButton_Cancel */
// Version 1.0 (c) John Murphy 20th-Oct-2019
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
#include "DialogLib.js"
/**
 * Default the Reference view to a view that contains "Mosaic" in its name, but
 * doesn't start with "PM_" (e.g. graph windows).
 * If there is more than one "Mosaic" view, sort them and take the last one.
 * If there are no "Mosaic" views yet, return a view that doesn't start with
 * "PM_" and is not the active window.
 * @return {View} default reference view
 */
function getDefaultReferenceView() {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let mosaicWindows = [];
    for (let win of allWindows) {
        if (!win.mainView.fullId.startsWith(WINDOW_ID_PREFIX()) &&
                win.mainView.fullId.toLowerCase().contains("mosaic")){
            mosaicWindows.push(win.mainView.fullId);
        }
    }
    if (mosaicWindows.length > 0){
        mosaicWindows.sort();
        return View.viewById( mosaicWindows[mosaicWindows.length - 1] );
    }
    for (let win of allWindows) {
        if (!win.mainView.fullId.startsWith(WINDOW_ID_PREFIX()) &&
                win !== ImageWindow.activeWindow){
            return win.mainView;
        }
    }
    return null;
}

/**
 * Default the target view to the current view provided it is not a graph/sample
 * window (starting with "PM__") and not the reference view.
 * Otherwise, return the first view that is not the reference view and is not
 * a graph/sample view. If all fails, return null
 * @param {View} referenceView
 * @returns {View} default target view
 */
function getDefaultTargetView(referenceView){
    function isGoodChoice(view){
        return !view.fullId.startsWith(WINDOW_ID_PREFIX()) &&
        (referenceView === null || referenceView.fullId !== view.fullId);
    };
    if (isGoodChoice(ImageWindow.activeWindow.mainView)){
        return ImageWindow.activeWindow.mainView;
    }
    let allWindows = ImageWindow.openWindows;
    for (let win of allWindows) {
        if (isGoodChoice(win.mainView)){
            return win.mainView;
        }
    }
    return null;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function PhotometricMosaicData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {
        if (this.referenceView.isMainView) {
            Parameters.set("referenceView", this.referenceView.fullId);
        }
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
          
        // Star Detection
        Parameters.set("starDetection", this.logStarDetection);
        
        // Photometric Star Search
        Parameters.set("starFluxTolerance", this.starFluxTolerance);
        Parameters.set("starSearchRadius", this.starSearchRadius);
        
        // Photometric Scale
        Parameters.set("limitPhotoStarsPercent", this.limitPhotoStarsPercent);
        Parameters.set("linearRange", this.linearRange);
        Parameters.set("outlierRemoval", this.outlierRemoval);
        
        // Join Region
        Parameters.set("hasJoinAreaPreview", this.hasJoinAreaPreview);
        Parameters.set("joinAreaPreviewLeft", this.joinAreaPreviewRect.x0);
        Parameters.set("joinAreaPreviewTop", this.joinAreaPreviewRect.y0);
        Parameters.set("joinAreaPreviewWidth", this.joinAreaPreviewRect.width);
        Parameters.set("joinAreaPreviewHeight", this.joinAreaPreviewRect.height);
        Parameters.set("taperFromJoin", this.taperFromJoin);
        Parameters.set("cropTargetToJoinRegionFlag", this.cropTargetToJoinRegionFlag);
        
        // Join Size
        Parameters.set("hasJoinSize", this.hasJoinSize);
        Parameters.set("joinSize", this.joinSize);
        
        // Gradient Sample Generation
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("sampleStarRadiusMult", this.sampleStarRadiusMult);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("maxSamples", this.maxSamples);
        
        // Overlap Area Gradient
        Parameters.set("overlapGradientSmoothness", this.overlapGradientSmoothness);
        Parameters.set("taperLength", this.taperLength);
        
        // Extrapolated Gradient
        Parameters.set("extrapolatedGradientFlag", this.extrapolatedGradientFlag);
        Parameters.set("extrapolatedGradientSmoothness", this.extrapolatedGradientSmoothness);
        
        // Mosaic Star Mask
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("maskStarRadiusMult", this.maskStarRadiusMult);
        Parameters.set("maskStarRadiusAdd", this.maskStarRadiusAdd);
        
        // Create Mosaic
        Parameters.set("createMosaicFlag", this.createMosaicFlag);
        Parameters.set("mosaicOverlayTgtFlag", this.mosaicOverlayTgtFlag);
        Parameters.set("mosaicRandomFlag", this.mosaicRandomFlag);
        Parameters.set("mosaicAverageFlag", this.mosaicAverageFlag); 
        
        Parameters.set("graphWidth", this.graphWidth);
        Parameters.set("graphHeight", this.graphHeight);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId);
        }
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId);
        }
        
        // Star Detection
        if (Parameters.has("starDetection"))
            this.logStarDetection = Parameters.getReal("starDetection");
        
        // Photometric Star Search
        if (Parameters.has("starFluxTolerance"))
            this.starFluxTolerance = Parameters.getReal("starFluxTolerance");
        if (Parameters.has("starSearchRadius"))
            this.starSearchRadius = Parameters.getReal("starSearchRadius");
        
        // Photometric Scale
        if (Parameters.has("limitPhotoStarsPercent"))
            this.limitPhotoStarsPercent = Parameters.getReal("limitPhotoStarsPercent");
        if (Parameters.has("linearRange"))
            this.linearRange = Parameters.getReal("linearRange");
        if (Parameters.has("outlierRemoval"))
            this.outlierRemoval = Parameters.getInteger("outlierRemoval");
        
        // Join Region
        {
            let x = 0;
            let y = 0;
            let w = 1;
            let h = 1;
            
            if (Parameters.has("hasJoinAreaPreview"))
                this.hasJoinAreaPreview = Parameters.getBoolean("hasJoinAreaPreview");
            if (Parameters.has("joinAreaPreviewLeft")){
                x = Parameters.getInteger("joinAreaPreviewLeft");
            }
            if (Parameters.has("joinAreaPreviewTop")){
                y = Parameters.getInteger("joinAreaPreviewTop");
            }
            if (Parameters.has("joinAreaPreviewWidth")){
                w = Parameters.getInteger("joinAreaPreviewWidth");
            }
            if (Parameters.has("joinAreaPreviewHeight")){
                h = Parameters.getInteger("joinAreaPreviewHeight");
            }
            this.joinAreaPreviewRect = new Rect(x, y, x + w, y + h);
            
            if (Parameters.has("taperFromJoin"))
                this.taperFromJoin = Parameters.getBoolean("taperFromJoin");
            if (Parameters.has("cropTargetToJoinRegionFlag"))
                this.cropTargetToJoinRegionFlag = Parameters.getBoolean("cropTargetToJoinRegionFlag");
        }
        
        // Join Size
        if (Parameters.has("hasJoinSize"))
            this.hasJoinSize = Parameters.getBoolean("hasJoinSize");
        if (Parameters.has("joinSize"))
            this.joinSize = Parameters.getInteger("joinSize");
        
        // Gradient Sample Generation
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("sampleStarRadiusMult"))
            this.sampleStarRadiusMult = Parameters.getReal("sampleStarRadiusMult");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("maxSamples"))
            this.maxSamples = Parameters.getInteger("maxSamples");
        
        // Gradient Tapered Correction
        if (Parameters.has("overlapGradientSmoothness"))
            this.overlapGradientSmoothness = Parameters.getReal("overlapGradientSmoothness");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
        
        // Gradient Propagated Correction
        if (Parameters.has("extrapolatedGradientFlag"))
            this.extrapolatedGradientFlag = Parameters.getBoolean("extrapolatedGradientFlag");
        if (Parameters.has("extrapolatedGradientSmoothness"))
            this.extrapolatedGradientSmoothness = Parameters.getReal("extrapolatedGradientSmoothness");
        
        // Mosaic Star Mask
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("maskStarRadiusMult"))
            this.maskStarRadiusMult = Parameters.getReal("maskStarRadiusMult");
        if (Parameters.has("maskStarRadiusAdd"))
            this.maskStarRadiusAdd = Parameters.getReal("maskStarRadiusAdd");
        
        // Create Mosaic
        if (Parameters.has("createMosaicFlag"))
            this.createMosaicFlag = Parameters.getBoolean("createMosaicFlag");
        if (Parameters.has("mosaicOverlayTgtFlag"))
            this.mosaicOverlayTgtFlag = Parameters.getBoolean("mosaicOverlayTgtFlag");
        if (Parameters.has("mosaicRandomFlag"))
            this.mosaicRandomFlag = Parameters.getBoolean("mosaicRandomFlag");
        if (Parameters.has("mosaicAverageFlag"))
            this.mosaicAverageFlag = Parameters.getBoolean("mosaicAverageFlag");
        
        if (Parameters.has("graphWidth"))
            this.graphWidth = Parameters.getInteger("graphWidth");
        if (Parameters.has("graphHeight"))
            this.graphHeight = Parameters.getInteger("graphHeight");
    };

    // Initialise the scripts data
    this.setParameters = function () {
        // Star Detection
        this.logStarDetection = -1;
        
        // Photometric Star Search
        this.starFluxTolerance = 1.25;
        this.starSearchRadius = 2.5;
        
        // Photometric Scale
        this.limitPhotoStarsPercent = 90;
        this.linearRange = 0.5;
        this.outlierRemoval = 0;
        
        // Limit Gradient Sample Area
        this.hasJoinAreaPreview = false;
        this.joinAreaPreviewRect = new Rect(0, 0, 1, 1);
        this.taperFromJoin = false;
        this.cropTargetToJoinRegionFlag = false;
        
        // Join Size
        this.hasJoinSize = true;
        this.joinSize = 20;
        
        // Gradient Sample Generation
        this.limitSampleStarsPercent = 10;
        this.sampleStarRadiusMult = 5;
        this.sampleSize = 15;
        this.maxSamples = 2000;
        
        // Gradient Tapered Correction
        this.overlapGradientSmoothness = -1;
        this.taperLength = 50;
        
        // Gradient Propagated Correction
        this.extrapolatedGradientFlag = true;
        this.extrapolatedGradientSmoothness = 2;
        
        // Mosaic Star Mask
        this.limitMaskStarsPercent = 10;
        this.maskStarRadiusMult = 5;
        this.maskStarRadiusAdd = 2;
        
        // Create Mosaic
        this.createMosaicFlag = true;
        this.mosaicOverlayTgtFlag = false;
        this.mosaicRandomFlag = true;
        this.mosaicAverageFlag = false;
        
        this.graphWidth = 1000; // Gradient graph width
        this.graphHeight = 800; // Photometric and Gradient graph height
        
        // Set by '... Graph', 'Sample Grid', 'Create Mask' buttons
        this.testFlag = 0;
        
        this.cache = new MosaicCache();
        
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        // Reset the script's data
        this.setParameters();
        
        // Star Detection
        linearFitDialog.starDetectionControl.setValue(this.logStarDetection);
        
        // Photometric Star Search
        linearFitDialog.starFluxTolerance_Control.setValue(this.starFluxTolerance);
        linearFitDialog.starSearchRadius_Control.setValue(this.starSearchRadius);
        
        // Photometric Scale
        linearFitDialog.limitPhotoStarsPercent_Control.setValue(this.limitPhotoStarsPercent);
        linearFitDialog.rejectHigh_Control.setValue(this.linearRange);
        linearFitDialog.outlierRemoval_Control.setValue(this.outlierRemoval);
        
        // Join Region
        linearFitDialog.rectangleX0_Control.setValue(this.joinAreaPreviewRect.x0);
        linearFitDialog.rectangleY0_Control.setValue(this.joinAreaPreviewRect.y0);
        linearFitDialog.rectangleWidth_Control.setValue(this.joinAreaPreviewRect.width);
        linearFitDialog.rectangleHeight_Control.setValue(this.joinAreaPreviewRect.height);
        linearFitDialog.setHasJoinAreaPreview(this.hasJoinAreaPreview);
        linearFitDialog.taperFromJoin_Control.checked = this.taperFromJoin;
        linearFitDialog.cropTarget_Control.checked = this.cropTargetToJoinRegionFlag;
        
        // Join Size
        linearFitDialog.joinSize_Control.setValue(this.joinSize);
        linearFitDialog.setHasJoinSize(this.hasJoinSize);
        
        // Gradient Sample Generation
        linearFitDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        linearFitDialog.sampleStarRadiusMult_Control.setValue(this.sampleStarRadiusMult);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.maxSamples_Control.setValue(this.maxSamples);
        
        // Gradient Tapered Correction
        linearFitDialog.overlapGradientSmoothnessControl.setValue(this.overlapGradientSmoothness);
        linearFitDialog.taperLength_Control.setValue(this.taperLength);
        
        // Gradient Propagated Correction
        linearFitDialog.extrapolatedGradientSmoothness_Control.setValue(this.extrapolatedGradientSmoothness);
        linearFitDialog.setExtrapolateGradientFlag(this.extrapolatedGradientFlag);
        
        // Mosaic Star Mask
        linearFitDialog.LimitMaskStars_Control.setValue(this.limitMaskStarsPercent);
        linearFitDialog.maskStarRadiusMult_Control.setValue(this.maskStarRadiusMult);
        linearFitDialog.maskStarRadiusAdd_Control.setValue(this.maskStarRadiusAdd);
        
        // Create Mosaic
        linearFitDialog.setCreateMosaicFlag(this.createMosaicFlag);
        linearFitDialog.mosaicOverlayTgtControl.checked = this.mosaicOverlayTgtFlag;
        linearFitDialog.mosaicRandomControl.checked = this.mosaicRandomFlag;
        linearFitDialog.mosaicAverageControl.checked = this.mosaicAverageFlag;
    };
    
    // Initialise the script's data
    this.setParameters();
    this.referenceView = getDefaultReferenceView();
    this.targetView = getDefaultTargetView(this.referenceView);
}

// The main dialog function
function PhotometricMosaicDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    let self = this;
    
    const OUTLIER_REMOVAL_STRLEN = this.font.width("Outlier Removal:");
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            this.dialog.setVariableSize();
        } else {
//            bar.updateSection();
            this.dialog.setFixedSize();
        }
    };
    
    // =======================================
    // SectionBar: "Quick Start Guide"
    // =======================================
    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            " &mdash; Corrects the scale and gradient between two registered images.</b><br />" +
            "(1) Each join should be approximately vertical or horizontal.<br />" +
            "(2) Join frames into either rows or columns.<br />" +
            "(3) Join these strips to create the final mosaic.<br />" +
            "Copyright &copy; 2019-2020 John Murphy");
    let titleSection = new Control(this);
    titleSection.sizer = new VerticalSizer;
    titleSection.sizer.add(titleLabel);
    titleSection.setMinSize(650, 60);
    let titleBar = new SectionBar(this, "Quick Start Guide");
    titleBar.setSection(titleSection);
    titleBar.onToggleSection = this.onToggleSection;
    // SectionBar "Quick Start Guide" End

    // =======================================
    // SectionBar: "Reference & Target Views"
    // =======================================
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference view:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = OUTLIER_REMOVAL_STRLEN;
    referenceImage_Label.toolTip = "<p>The reference image. This image will not be modified.</p>";

    let referenceImage_ViewList = new ViewList(this);
    referenceImage_ViewList.getMainViews();
    referenceImage_ViewList.minWidth = 470;
    if (data.referenceView !== null){
        referenceImage_ViewList.currentView = data.referenceView;
    }
    referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };

    let referenceImage_Sizer = new HorizontalSizer;
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(referenceImage_ViewList, 100);

    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target view:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = OUTLIER_REMOVAL_STRLEN;
    targetImage_Label.toolTip = "<p>This image is cloned, then multiplied by " +
            "the photometrically determined scale factor, and finally the gradient " +
            "is calculated and subtracted.</p>";

    let targetImage_ViewList = new ViewList(this);
    targetImage_ViewList.getMainViews();
    targetImage_ViewList.minWidth = 470;
    if (data.targetView !== null){
        targetImage_ViewList.currentView = data.targetView;
    }
    targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(targetImage_ViewList, 100);
    
    let selectViewSection = new Control(this);
    selectViewSection.sizer = new VerticalSizer;
    selectViewSection.sizer.spacing = 4;
    selectViewSection.sizer.add(referenceImage_Sizer);
    selectViewSection.sizer.add(targetImage_Sizer);
    let selectViewBar = new SectionBar(this, "Reference & Target Views");
    selectViewBar.setSection(selectViewSection);
    selectViewBar.onToggleSection = this.onToggleSection;
    // SectionBar "Reference & Target Views" End

    // =======================================
    // SectionBar: "Star Detection"
    // =======================================
    this.starDetectionControl = new NumericControl(this);
    this.starDetectionControl.real = false;
    this.starDetectionControl.label.text = "Star detection:";
    this.starDetectionControl.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.starDetectionControl.toolTip = "<p>Logarithm of the star detection " +
            "sensitivity. Increase this value to detect less stars.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starDetectionControl.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetectionControl.setRange(-2, 2);
    this.starDetectionControl.slider.setRange(0, 50);
    this.starDetectionControl.slider.minWidth = 50;
    this.starDetectionControl.setValue(data.logStarDetection);
    
    let detectedStarsButton = new PushButton();
    detectedStarsButton.text = "Detected stars";
    detectedStarsButton.toolTip =
            "<p>Displays all the stars detected in the reference and target images. " +
            "These stars are cached until either the Photometric Mosaic dialog " +
            "is closed or a modification invalidates the cache.</p>";
    detectedStarsButton.onClick = function () {
        data.viewFlag = DISPLAY_DETECTED_STARS();
        this.dialog.ok();
    };
    
    let starDetectionSection = new Control(this);
    starDetectionSection.sizer = new HorizontalSizer;
    starDetectionSection.sizer.add(this.starDetectionControl);
    starDetectionSection.sizer.addStretch();
    starDetectionSection.sizer.add(detectedStarsButton);
    let starDetectionBar = new SectionBar(this, "Star Detection");
    starDetectionBar.setSection(starDetectionSection);
    starDetectionBar.onToggleSection = this.onToggleSection;
    // SectionBar "Star Detection" End
    
    // =======================================
    // SectionBar: "Photometric Star Search"
    // =======================================
    const labelWidth = Math.max(
            this.font.width("Star flux tolerance:"), 
            this.font.width("Star search radius:"));
    this.starFluxTolerance_Control = new NumericControl(this);
    this.starFluxTolerance_Control.real = true;
    this.starFluxTolerance_Control.label.text = "Star flux tolerance:";
    this.starFluxTolerance_Control.toolTip =
            "<p>Star flux tolerance is used to prevent invalid target to reference " +
            "star matches. Smaller values reject more matches.</p>" +
            "<p>Star matches are rejected if the difference in star flux " +
            "is larger than expected. The algorithm first calculates the average scale difference, " +
            "and then rejects matches if their brightness ratio is greater than " +
            "(expected ratio * tolerance) or smaller than (expected ratio / tolerance)</p>" +
            "<p>1.0 implies the star flux ratio must exactly match the expected ratio.</p>" +
            "<p>2.0 implies that the ratio can be double or half the expected ratio.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starFluxTolerance_Control.label.minWidth = labelWidth;
    this.starFluxTolerance_Control.setRange(1.01, 2);
    this.starFluxTolerance_Control.slider.setRange(100, 200);
    this.starFluxTolerance_Control.setPrecision(2);
    this.starFluxTolerance_Control.slider.minWidth = 100;
    this.starFluxTolerance_Control.setValue(data.starFluxTolerance);
    this.starFluxTolerance_Control.onValueUpdated = function (value) {
        data.starFluxTolerance = value;
    };
    
    this.starSearchRadius_Control = new NumericControl(this);
    this.starSearchRadius_Control.real = true;
    this.starSearchRadius_Control.label.text = "Star search radius:";
    this.starSearchRadius_Control.toolTip =
            "<p>Search radius is used to match the reference and target stars. " +
            "Larger values find more photometric stars but at the risk of matching " +
            "the wrong star or even matching noise.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";

    this.starSearchRadius_Control.label.minWidth = labelWidth;
    this.starSearchRadius_Control.setRange(1, 10);
    this.starSearchRadius_Control.slider.setRange(1, 100);
    this.starSearchRadius_Control.setPrecision(1);
    this.starSearchRadius_Control.slider.minWidth = 100;
    this.starSearchRadius_Control.setValue(data.starSearchRadius);
    this.starSearchRadius_Control.onValueUpdated = function (value) {
        data.starSearchRadius = value;
    };
    
    let photometrySearchSection = new Control(this);
    photometrySearchSection.sizer = new VerticalSizer;
    photometrySearchSection.sizer.spacing = 4;
    photometrySearchSection.sizer.add(this.starFluxTolerance_Control);
    photometrySearchSection.sizer.add(this.starSearchRadius_Control);
    let photometrySearchBar = new SectionBar(this, "Photometric Star Search");
    photometrySearchBar.setSection(photometrySearchSection);
    photometrySearchBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Photometric Star Search" End
    
    // =======================================
    // SectionBar: "Photometric Scale"
    // =======================================
    this.limitPhotoStarsPercent_Control = new NumericControl(this);
    this.limitPhotoStarsPercent_Control.real = true;
    this.limitPhotoStarsPercent_Control.label.text = "Limit stars %:";
    this.limitPhotoStarsPercent_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.limitPhotoStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to " +
            "find photometric stars.</p>" +
            "<p>100% implies that all detected stars are used, up to a maximum of 1000.</p>" +
            "<p>90% implies that the faintest 10% of detected stars are rejected.</p>" +
            "<p>0% implies no stars will be used. The scale will default to one.</p>" +
            "<p>Including too many very faint stars can reduce the accuracy " +
            "of the calculated scale.</p>";
    this.limitPhotoStarsPercent_Control.onValueUpdated = function (value) {
        data.limitPhotoStarsPercent = value;
    };
    this.limitPhotoStarsPercent_Control.setRange(0, 100);
    this.limitPhotoStarsPercent_Control.slider.setRange(0, 200);
    this.limitPhotoStarsPercent_Control.setPrecision(2);
    this.limitPhotoStarsPercent_Control.slider.minWidth = 200;
    this.limitPhotoStarsPercent_Control.setValue(data.limitPhotoStarsPercent);
    
    this.rejectHigh_Control = new NumericControl(this);
    this.rejectHigh_Control.real = true;
    this.rejectHigh_Control.label.text = "Linear range:";
    this.rejectHigh_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.rejectHigh_Control.toolTip =
            "<p>Restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value. " +
            "Use this to reject stars that are outside the " +
            "camera's linear response range.</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.linearRange = value;
    };
    this.rejectHigh_Control.setRange(0.001, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 500);
    this.rejectHigh_Control.setPrecision(3);
    this.rejectHigh_Control.slider.minWidth = 200;
    this.rejectHigh_Control.setValue(data.linearRange);

    let photometricScaleHorizSizer1 = new HorizontalSizer;
    photometricScaleHorizSizer1.spacing = 4;
    photometricScaleHorizSizer1.add(this.rejectHigh_Control);
    photometricScaleHorizSizer1.addStretch();
    
    this.outlierRemoval_Control = new NumericControl(this);
    this.outlierRemoval_Control.real = false;
    this.outlierRemoval_Control.label.text = "Outlier removal:";
    this.outlierRemoval_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.outlierRemoval_Control.toolTip =
            "<p>The photometric measurement of some stars can be suspect. " +
            "For example, a star's size may be underestimated causing some of " +
            "its flux to contribute to the background measurement. " +
            "This control determines the number of outlier stars to remove. " +
            "This can improve accuracy, but don't over do it!</p>" +
            "<p>Use the 'Photometry graph' button to see the " +
            "photometry data points and their best fit line.</p>";
    this.outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
    };
    this.outlierRemoval_Control.setRange(0, 50);
    this.outlierRemoval_Control.slider.setRange(0, 50);
    this.outlierRemoval_Control.slider.minWidth = 221;
    this.outlierRemoval_Control.setValue(data.outlierRemoval);
    
    let photometryGraphButton = new PushButton();
    photometryGraphButton.text = "Photometry graph";
    photometryGraphButton.toolTip =
            "<p>For each star detected within the overlap area, " +
            "provided the star meets the photometry criteria, the star's reference flux " +
            "is plotted against its target flux.</p>" +
            "<p>Color (red, green and blue) is used to represent the data for each color channel.</p>" +
            "<p>The plotted lines indicate the " +
            "best fit lines (least squares fit) that go through the origin. " +
            "The gradient of these lines gives the required scale factors. </p>" +
            "<p>See graph tooltip for usage instructions.</p>";
    photometryGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_PHOTOMETRY_GRAPH();
        this.dialog.ok();
    };
    
    let photometryStarsButton = new PushButton();
    photometryStarsButton.text = "Photometry stars";
    photometryStarsButton.toolTip =
            "<p>Displays the stars that met the criteria for photometry. " +
            "These stars were within the specified 'Linear range' and were found " +
            "in both target and reference images and were not rejected by 'Outlier removal'.</p>" +
            "<p>The color represents the color channel. " +
            "Hence a white square indicates the star was found in the red, green and blue channels.</p>" +
            "<p>Useful data is also saved to the FITS header, " +
            "including the position of the star that has the largest error.</p>";
    photometryStarsButton.onClick = function () {
        data.viewFlag = DISPLAY_PHOTOMETRY_STARS();
        this.dialog.ok();
    };
    
    let photometricScaleHorizSizer2 = new HorizontalSizer;
    photometricScaleHorizSizer2.spacing = 4;
    photometricScaleHorizSizer2.add(this.outlierRemoval_Control);
    photometricScaleHorizSizer2.addStretch();
    photometricScaleHorizSizer2.add(photometryGraphButton);
    photometricScaleHorizSizer2.addSpacing(2);
    photometricScaleHorizSizer2.add(photometryStarsButton);
    
    let photometrySection = new Control(this);
    photometrySection.sizer = new VerticalSizer;
    photometrySection.sizer.spacing = 4;
    photometrySection.sizer.add(this.limitPhotoStarsPercent_Control);
    photometrySection.sizer.add(photometricScaleHorizSizer1);
    photometrySection.sizer.add(photometricScaleHorizSizer2);
    let photometryBar = new SectionBar(this, "Photometric Scale");
    photometryBar.setSection(photometrySection);
    photometryBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Photometric Scale" End

    // =======================================
    // SectionBar: "Join Region (from preview)"
    // =======================================
    const getAreaFromPreviewStr = "From preview:";
    const GET_AREA_FROM_PREVIEW_STRLEN = this.font.width(getAreaFromPreviewStr);
    const JoinRegionTooltip =
            "<p>Limits the join region to a subset of the overlap area.</p>" +
            "<p>The join region determines the size and position of the join " +
            "between the two images. The rectangle's long axis should align with the join " +
            "and should ideally avoid low quality regions such as image corners. " +
            "Provided 'Crop target' is not selected, the " +
            "long axis of the join region is updated to start and finish at the overlap's bounding box. " +
            "The ideal size and position of the Join Region rectangle depends on " +
            "the Mosaic combination mode:</p>" +
            "<ul><li>Overlay: The primary join line runs along the middle of the Join Region. " +
            "Ideally this line should avoids bright stars.</li>" +
            "<li>Random: The rectangle should be thick enough to blend the two " +
            "sides of the join.</li>" +
            "<li>Average: The join region' determines the area that will benefit " +
            "from the enhanced signal to noise ratio.</li></ul>" +
             "<p>It is not necessary for the join region to contain any stars. The whole of the " +
            "overlap area is always used to determine the photometric scale and background gradient.</p>" +
            "<p>Inside the join region, the behavior depends on the mosaic combination mode. " +
            "The behavior outside this region:" +
            "<ul><li>Reference side of join region: Reference overlay</li>" +
            "<li>Target side of join region: Target overlay</li></ul></p>";
            
    this.rectangleX0_Control = createNumericEdit("Left:", JoinRegionTooltip,
            data.joinAreaPreviewRect.x0, 50);
    this.rectangleX0_Control.label.setFixedWidth(
            this.font.width("Left:") + GET_AREA_FROM_PREVIEW_STRLEN + 4);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    this.rectangleY0_Control = createNumericEdit("Top:", JoinRegionTooltip,
            data.joinAreaPreviewRect.y0, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    this.rectangleWidth_Control = createNumericEdit("Width:", JoinRegionTooltip,
            data.joinAreaPreviewRect.width, 50);
    this.rectangleWidth_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    this.rectangleHeight_Control = createNumericEdit("Height:", JoinRegionTooltip,
            data.joinAreaPreviewRect.height, 50);
    this.rectangleHeight_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    
    function getJoinAreaPreviewRect(){
        let x = self.rectangleX0_Control.value;
        let y = self.rectangleY0_Control.value;
        let w = self.rectangleWidth_Control.value;
        let h = self.rectangleHeight_Control.value;
        return new Rect(x, y, x + w, y + h);
    }

    let joinAreaHorizSizer1 = new HorizontalSizer; 
    joinAreaHorizSizer1.spacing = 10;
    joinAreaHorizSizer1.add(this.rectangleX0_Control);
    joinAreaHorizSizer1.add(this.rectangleY0_Control);
    joinAreaHorizSizer1.add(this.rectangleWidth_Control);
    joinAreaHorizSizer1.add(this.rectangleHeight_Control);
    joinAreaHorizSizer1.addStretch();

    function previewUpdateActions(dialog){
        let view = dialog.previewImage_ViewList.currentView;
        if (view !== null && view.isPreview) {
            dialog.joinAreaBar.checkBox.checked = data.hasJoinAreaPreview;
            data.joinAreaPreviewRect = view.window.previewRect(view);
            dialog.rectangleX0_Control.setValue(data.joinAreaPreviewRect.x0);
            dialog.rectangleY0_Control.setValue(data.joinAreaPreviewRect.y0);
            dialog.rectangleWidth_Control.setValue(data.joinAreaPreviewRect.width);
            dialog.rectangleHeight_Control.setValue(data.joinAreaPreviewRect.height);
            
            dialog.setHasJoinAreaPreview(true);
        } else {
            dialog.setHasJoinAreaPreview(false);
        }
    };

    // Get Area from preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = getAreaFromPreviewStr;
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Initialize the 'Join Region' from a preview.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        previewUpdateActions(this.dialog);
    };

    let previewUpdateButton = new PushButton();
    previewUpdateButton.hasFocus = false;
    previewUpdateButton.text = "Update";
    previewUpdateButton.onClick = function () {
        if (!this.isUnderMouse){
            // Ensure pressing return in a different field does not trigger this callback!
            return;
        }
        previewUpdateActions(this.dialog);
    };

    let joinAreaHorizSizer2 = new HorizontalSizer;
    joinAreaHorizSizer2.spacing = 4;
    joinAreaHorizSizer2.add(previewImage_Label);
    joinAreaHorizSizer2.add(this.previewImage_ViewList, 100);
    joinAreaHorizSizer2.addSpacing(10);
    joinAreaHorizSizer2.add(previewUpdateButton);
    
    this.setHasJoinAreaPreview = function(checked){
        data.hasJoinAreaPreview = checked;
        self.joinAreaBar.checkBox.checked = checked;
        self.rectangleX0_Control.enabled = checked;
        self.rectangleWidth_Control.enabled = checked;
        self.rectangleY0_Control.enabled = checked;
        self.rectangleHeight_Control.enabled = checked;
        self.taperFromJoin_Control.enabled = checked;
        self.cropTarget_Control.enabled = checked;
        if (checked){
            self.setHasJoinSize(false);
        } else {
            data.taperFromJoin = false;
            self.taperFromJoin_Control.checked = false;
            data.cropTargetToJoinRegionFlag = false;
            self.cropTarget_Control.checked = false; 
        }
    };
    
    this.taperFromJoin_Control = new CheckBox();
    this.taperFromJoin_Control.text = "Taper from join";
    this.taperFromJoin_Control.toolTip = 
            "<p>Moves the taper from the target side of the " +
            "overlap bounding box to the target side of the join region.</p>" +
            "<p>The target image's offset and gradient are fully corrected within the join region, " +
            "but outside the overlap bounding box the gradient can only be partially " +
            "corrected. A taper is applied to blend these two regions together.</p>" +
            "<p>The taper is usually applied at the target side boundary of the " +
            "overlap bounding box. If this option is selected, the taper is " +
            "applied from the target side of the 'Join Region' instead.<p>" +
            "<p>You should only select this option if there is a bright star on the " +
            "target side boundary of the overlap bounding box that is causing a " +
            "brightening or darkening in the taper zone on the target side of the star.</p>" +
            "<p>Inspect the 'Gradient graph' (Overlap Area Gradient section) to " +
            "check for peaks in the gradient curve.</p>" +
            "<p>Caution: if the images wrap around each other at the sides, " +
            "selecting this option may affect the correction applied to these side joins.</p>";
            
    this.taperFromJoin_Control.onCheck = function (checked){
        data.taperFromJoin = checked;
    };
    this.taperFromJoin_Control.checked = data.taperFromJoin;
    
    this.cropTarget_Control = new CheckBox();
    this.cropTarget_Control.text = "Crop target";
    this.cropTarget_Control.toolTip = 
        "<p>Restricts target image pixels to the Join Region. " +
        "All target pixels outside the Join Region are ignored.</p>" +
        "<p>This can be used to fix a small area of the mosaic or to add a high res image to a wider mosaic.</p>" +
        "<p>This option only supports the mosaic combination modes 'Overlay' and 'Average'.</p>";
    this.cropTarget_Control.onCheck = function (checked){
        data.cropTargetToJoinRegionFlag = checked;
    };
    this.cropTarget_Control.checked = data.cropTargetToJoinRegionFlag;
    
    let joinAreaFlagsHorizSizer = new HorizontalSizer;
    joinAreaFlagsHorizSizer.addSpacing(GET_AREA_FROM_PREVIEW_STRLEN + 4);
    joinAreaFlagsHorizSizer.add(this.taperFromJoin_Control);
    joinAreaFlagsHorizSizer.addSpacing(20);
    joinAreaFlagsHorizSizer.add(this.cropTarget_Control);
    joinAreaFlagsHorizSizer.addStretch();
    
    let joinAreaSection = new Control(this);
    joinAreaSection.sizer = new VerticalSizer;
    joinAreaSection.sizer.spacing = 4;
    joinAreaSection.sizer.add(joinAreaHorizSizer1);
    joinAreaSection.sizer.add(joinAreaHorizSizer2);
    joinAreaSection.sizer.add(joinAreaFlagsHorizSizer);
    this.joinAreaBar = new SectionBar(this, "Join Region (from preview)");
    this.joinAreaBar.setSection(joinAreaSection);
    this.joinAreaBar.enableCheckBox();
    this.joinAreaBar.toolTip = JoinRegionTooltip;
    this.joinAreaBar.checkBox.onClick = this.setHasJoinAreaPreview;
    this.joinAreaBar.onToggleSection = this.onToggleSection;
    this.setHasJoinAreaPreview(data.hasJoinAreaPreview);
    // SectionBar "Join Region" End

    // =======================================
    // SectionBar: "Join Region (from size)"
    // =======================================
    let joinSizeTooltip = 
            "<p>Limits the join region to a subset of the overlap area.</p>";
    this.joinSize_Control = new NumericControl(this);
    this.joinSize_Control.real = false;
    this.joinSize_Control.label.text = "Join size:";
    this.joinSize_Control.toolTip = joinSizeTooltip;
            
    this.joinSize_Control.onValueUpdated = function (value) {
        data.joinSize = value;
    };
    this.joinSize_Control.setRange(1, 250);
    this.joinSize_Control.slider.setRange(1, 250);
    this.joinSize_Control.slider.minWidth = 250;
    this.joinSize_Control.setValue(data.joinSize);
    
    this.setHasJoinSize = function(checked){
        if (checked){
            self.setHasJoinAreaPreview(false);
        }
        data.hasJoinSize = checked;
        self.joinSizeBar.checkBox.checked = checked;
        self.joinSize_Control.enabled = checked;
    };
    
    let joinSizeSection = new Control(this);
    joinSizeSection.sizer = new VerticalSizer;
    joinSizeSection.sizer.spacing = 4;
    joinSizeSection.sizer.add(this.joinSize_Control);
    this.joinSizeBar = new SectionBar(this, "Join Region (from size)");
    this.joinSizeBar.setSection(joinSizeSection);
    this.joinSizeBar.enableCheckBox();
    this.joinSizeBar.toolTip = joinSizeTooltip;
    this.joinSizeBar.checkBox.onClick = this.setHasJoinSize;
    this.joinSizeBar.onToggleSection = this.onToggleSection;
    this.setHasJoinSize(data.hasJoinSize);
    // SectionBar "Join Region" End

    // =======================================
    // SectionBar: "Gradient Sample Generation"
    // =======================================
    const SampleGenerationStrLen = this.font.width("Multiply star radius:");
    this.limitSampleStarsPercent_Control = new NumericControl(this);
    this.limitSampleStarsPercent_Control.real = false;
    this.limitSampleStarsPercent_Control.label.text = "Limit stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = SampleGenerationStrLen;
    this.limitSampleStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. This can effect how many of the " +
            "pixels illuminated by a star fall into a neighboring sample.</li></ul>" +
            "<p>It is only necessary to reject bright stars. This script uses the " +
            "median value from each sample, so any star that takes up less than " +
            "half the sample area will have little effect. It is more important to " +
            "include most of the samples than to reject faint stars.</p>";
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    this.limitSampleStarsPercent_Control.setRange(0, 100);
    this.limitSampleStarsPercent_Control.slider.setRange(0, 100);
    this.limitSampleStarsPercent_Control.slider.minWidth = 140;
    this.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);
    
    this.sampleStarRadiusMult_Control = new NumericControl(this);
    this.sampleStarRadiusMult_Control.real = true;
    this.sampleStarRadiusMult_Control.label.text = "Multiply star radius:";
    this.sampleStarRadiusMult_Control.label.minWidth = SampleGenerationStrLen;
    this.sampleStarRadiusMult_Control.toolTip =
            "<p>Increase to reject more samples around saturated stars.</p>" +
            "<p>Use the 'Sample grid' button to visualize the grid of samples.</p>";
    this.sampleStarRadiusMult_Control.onValueUpdated = function (value) {
        data.sampleStarRadiusMult = value;
    };
    this.sampleStarRadiusMult_Control.setPrecision(1);
    this.sampleStarRadiusMult_Control.setRange(1, 25);
    this.sampleStarRadiusMult_Control.slider.setRange(1, 250);
    this.sampleStarRadiusMult_Control.slider.minWidth = 250;
    this.sampleStarRadiusMult_Control.setValue(data.sampleStarRadiusMult);
    
    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = false;
    this.sampleSize_Control.label.text = "Sample size:";
    this.sampleSize_Control.label.minWidth = SampleGenerationStrLen;
    this.sampleSize_Control.toolTip =
            "<p>Specifies the size of the sample squares.</p>" +
            "<p>The overlap area is divided up into a grid of sample squares. " +
            "A sample's value is the median of the pixels it contains. " +
            "These sample values are used to calculate the background offset and gradient. " +
            "Using samples ensures that the offset and gradient calculation is " +
            "less affected by bright stars with differing profiles.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star bright enough to be included " +
            "in the 'Limit stars %' list.</p>" +
            "<p>Ideally, the samples should be about 1.5x the size of the largest star.</p>" +
            "<p>The samples are used to create a surface spline that models the " +
            "background gradient. The sample size and the number of surviving samples " +
            "determines the maximum theoretical resolution of the surface spline. " +
            "However, very small samples will suffer from noise.</p>" +
            "<p>Use the 'Sample grid' button to visualize the grid of samples.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(3, 50);
    this.sampleSize_Control.slider.setRange(3, 50);
    this.sampleSize_Control.slider.minWidth = 200;
    this.sampleSize_Control.setValue(data.sampleSize);
    
    let displaySamplesButton = new PushButton();
    displaySamplesButton.text = "Sample grid";
    displaySamplesButton.toolTip =
            "<p>Displays the grid of samples that will " +
            "be used to calculate the background offset and gradient.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star included in the 'Limit stars %' list. " +
            "The surviving samples are drawn as squares. The stars used to " +
            "reject samples are indicated by circles.</p>";
    displaySamplesButton.onClick = function () {
        data.viewFlag = DISPLAY_GRADIENT_SAMPLES();
        this.dialog.ok();
    };
    
    let sampleGridSizer = new HorizontalSizer;
    sampleGridSizer.spacing = 4;
    sampleGridSizer.add(this.sampleSize_Control);
    sampleGridSizer.addSpacing(20);
    sampleGridSizer.add(displaySamplesButton);
    
    this.maxSamples_Control = new NumericControl(this);
    this.maxSamples_Control.real = false;
    this.maxSamples_Control.label.text = "Max samples:";
    this.maxSamples_Control.label.minWidth = SampleGenerationStrLen;
    this.maxSamples_Control.toolTip =
            "<p>Limits the number of samples used to create the surface spline. " +
            "If the number of samples exceed this limit, they are combined " +
            "(binned) to create super samples.</p>" +
            "<p>Increase it if the overlap area is very large. " +
            "A larger number of samples increases the " +
            "theoretical maximum resolution of the surface spline. However, " +
            "small unbinned samples are noiser and require more smoothing. " +
            "The default value is usually a good compromise.</p>" +
            "<p>The time required to initialize the surface spline approximately " +
            "doubles every 1300 samples.</p>" +
            "<p>Use the 'Binned grid' button to visualize the binned samples.</p>";
    this.maxSamples_Control.onValueUpdated = function (value) {
        data.maxSamples = value;
    };
    this.maxSamples_Control.setRange(1000, 5000);
    this.maxSamples_Control.slider.setRange(100, 500);
    this.maxSamples_Control.slider.minWidth = 200;
    this.maxSamples_Control.setValue(data.maxSamples);
    
    let displayBinnedSamplesButton = new PushButton();
    displayBinnedSamplesButton.text = "Binned grid ";
    displayBinnedSamplesButton.toolTip =
            "<p>Displays the binned samples that will " +
            "be used to calculate the background offset and gradient.</p>" +
            "<p>Samples are binned to improve performance if the number of " +
            "samples exceeds the specified limit.</p>" +
            "<p>The area of each binned sample represents the number of samples " +
            "it was created from.</p>" +
            "<p>Each binned sample's center is calculated from " +
            "the center of mass of the samples it was created from.</p>" +
            "<p>To see which of the unbinned samples were rejected due to stars, " +
            "use 'Sample grid'.</p>";
    displayBinnedSamplesButton.onClick = function () {
        data.viewFlag = DISPLAY_BINNED_SAMPLES();
        this.dialog.ok();
    };
    
    let maxSamplesSizer = new HorizontalSizer;
    maxSamplesSizer.spacing = 4;
    maxSamplesSizer.add(this.maxSamples_Control);
    maxSamplesSizer.addSpacing(20);
    maxSamplesSizer.add(displayBinnedSamplesButton);
    
    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new VerticalSizer;
    sampleGenerationSection.sizer.spacing = 4;
    sampleGenerationSection.sizer.add(this.limitSampleStarsPercent_Control);
    sampleGenerationSection.sizer.add(this.sampleStarRadiusMult_Control);
    sampleGenerationSection.sizer.add(sampleGridSizer);
    sampleGenerationSection.sizer.add(maxSamplesSizer);
    let sampleGenerationBar = new SectionBar(this, "Gradient Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Gradient Sample Generation" End
    
    // =======================================
    // SectionBar: "Overlap Area Gradient"
    // =======================================
    // Gradient controls
    this.overlapGradientSmoothnessControl = new NumericControl(this);
    this.overlapGradientSmoothnessControl.real = true;
    this.overlapGradientSmoothnessControl.setPrecision(1);
    this.overlapGradientSmoothnessControl.label.text = "Smoothness:";
    this.overlapGradientSmoothnessControl.label.minWidth = this.font.width("Taper length:");
    this.overlapGradientSmoothnessControl.toolTip =
        "<p>Logarithm of the smoothness setting. " +
        "Determines the smoothness of the gradient correction " +
        "applied to the overlap area.</p>" +
        "<p>The 'Smoothness' control determines how closely the " +
        "correction follows the sample pair data points. " +
        "Smaller values apply less smoothing. " +
        "The aim is to correct both the gradient trends and " +
        "the local variations, such as the diffuse light around " +
        "bright stars, but with enough smoothing to avoid following noise.</p>" +
        "<p>Use the 'Gradient graph' to determine the optimum smoothness.</p>" +
        "<p>The full correction is applied across the whole of the overlap's " +
        "bounding box.</p>";
    this.overlapGradientSmoothnessControl.onValueUpdated = function (value) {
        data.overlapGradientSmoothness = value;
    };
    this.overlapGradientSmoothnessControl.setRange(-4, 3);
    this.overlapGradientSmoothnessControl.slider.setRange(-400, 300);
    this.overlapGradientSmoothnessControl.slider.minWidth = 140;
    this.overlapGradientSmoothnessControl.setValue(data.overlapGradientSmoothness);
    
    let overlapGradientGraphButton = new PushButton();
    overlapGradientGraphButton.text = "Gradient graph";
    overlapGradientGraphButton.toolTip =
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent the difference between each paired target and " +
        "reference sample within the whole of the overlap area. " +
        "These points are typically scattered vertically. This is partly due to gradients " +
        "perpendicular to the join, and partly due to noise.<\p>" +
        "<p>The bold curve(s) shows the gradient along the primary join path(s). " +
        "It depends on the mosaic combine mode and the Join Region " +
        "(if a Join Region has not been defined, it defaults to the overlap bounding box).</p>" +
        "<p>Overlay: The primary path runs along the join, at the center of the Join Region. " +
        "This is the transition between reference overlay and target overlay.</p>" +
        "<p>Random or Average: The primary paths run along the sides of the Join Region. " +
        "These two paths are at the transition where the Random or Average combine starts and finishes.</p>" +
        "<p>The thinner darker line is the gradient correction along the path of the " +
        "secondary join. This path is the target side of the overlap area's bounding box " +
        "or, if 'Taper from join' is selected, the target side of the 'Join Region'.</p>" +
        "<p>The graphs produced for color images use red, green and blue dots " +
        "and lines for each channel. The colors add together. " +
        "For example: red, green and blue add up to white.</p>";
    overlapGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_OVERLAP_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    let taperTooltip = "<p>The length of the taper that's applied between the " +
        "fully corrected overlap bounding box area and the rest of the " +
        "partially corrected target image to provide a smooth transition. " +
        "In most cases the default taper length usually works well, " +
        "but make sure the taper finishes before the the end of the target image. " +
        "However, if there is a strong peak in the gradient graph's secondary " +
        "join curve (e.g. due to a star halo) a short taper may be necessary " +
        "to avoid a darker or brighter area in the taper region.</p>";
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Taper length:";
    this.taperLength_Control.label.minWidth = this.font.width("Taper length:");
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(0, 500);
    this.taperLength_Control.slider.setRange(0, 500);
    this.taperLength_Control.slider.minWidth = 500;
    this.taperLength_Control.setValue(data.taperLength);
    
    let overlapGradientSizer = new HorizontalSizer;
    overlapGradientSizer.spacing = 4;
    overlapGradientSizer.add(this.overlapGradientSmoothnessControl);
    overlapGradientSizer.addSpacing(20);
    overlapGradientSizer.add(overlapGradientGraphButton);
    
    let overlapGradientSection = new Control(this);
    overlapGradientSection.sizer = new VerticalSizer;
    overlapGradientSection.sizer.spacing = 4;
    overlapGradientSection.sizer.add(overlapGradientSizer);
    overlapGradientSection.sizer.add(this.taperLength_Control);
    let gradientBar = new SectionBar(this, "Overlap Area Gradient");
    gradientBar.setSection(overlapGradientSection);
    gradientBar.onToggleSection = this.onToggleSection;
    //SectionBar: "Gradient Correction" End
    
    // =======================================
    // SectionBar: "Extrapolated Gradient"
    // =======================================
    this.extrapolatedGradientSmoothness_Control = new NumericControl(this);
    this.extrapolatedGradientSmoothness_Control.real = true;
    this.extrapolatedGradientSmoothness_Control.setPrecision(1);
    this.extrapolatedGradientSmoothness_Control.label.text = "Smoothness:";
    this.extrapolatedGradientSmoothness_Control.toolTip =
        "<p>Logarithm of the smoothness setting. " +
        "Determines the smoothness of the extrapolated gradient correction. This is " +
        "applied to the rest of the target image after the target side of the overlap area.</p>" +
        "<p>The 'Smoothness' control determines how closely the " +
        "correction follows the sample pair data points. " +
        "Smaller values apply less smoothing. " +
        "The aim is to only correct the gradient trends and not " +
        "the local variations, such as the diffuse light around " +
        "bright stars. These local gradients are unlikely to be valid " +
        "at the other side of the target image.</p>" +
        "<p>Use the 'Gradient graph' to determine the optimum smoothness.</p>" +
        "<p>The reference image's gradient will be propagated across the mosaic, " +
        "so consider using DBE as a final correction once the mosaic is complete.</p>";
    this.extrapolatedGradientSmoothness_Control.onValueUpdated = function (value) {
        data.extrapolatedGradientSmoothness = value;
    };
    this.extrapolatedGradientSmoothness_Control.setRange(-1, 6);
    this.extrapolatedGradientSmoothness_Control.slider.setRange(-100, 600);
    this.extrapolatedGradientSmoothness_Control.slider.minWidth = 140;
    this.extrapolatedGradientSmoothness_Control.setValue(data.extrapolatedGradientSmoothness);
    
    let extrapolatedGradientGraphButton = new PushButton();
    extrapolatedGradientGraphButton.text = "Gradient graph";
    extrapolatedGradientGraphButton.toolTip =
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent the difference between each paired target and " +
        "reference sample within the whole of the overlap area. " +
        "These points are typically scattered vertically. This is partly due to gradients " +
        "perpendicular to the join, and partly due to noise.<\p>" +
        "<p>The curve is the gradient correction along the path of the " +
        "secondary join. " +
        "This path is the target side of the overlap area's bounding box " +
        "or, if 'Taper from join' is selected, the target side of the 'Join Region'. " +
        "This gradient will be applied to the rest of the target image.</p>" +
        "<p>If there is a gradient perpendicular to the join, the curve will " +
        "tend to follow the top or bottom envelope of the plotted points.</p>" +
        "<p>The graphs produced for color images use red, green and blue dots " +
        "and lines for each channel. The colors add together. " +
        "For example: red, green and blue add up to white.</p>";
    extrapolatedGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    this.setExtrapolateGradientFlag = function (checked){
        data.extrapolatedGradientFlag = checked;
        self.extrapolatedGradientBar.checkBox.checked = checked;
        self.extrapolatedGradientSmoothness_Control.enabled = checked;
        extrapolatedGradientGraphButton.enabled = checked;
    };
    
    let extrapolatedGradientSection = new Control(this);
    extrapolatedGradientSection.sizer = new HorizontalSizer;
    extrapolatedGradientSection.sizer.spacing = 10;
    extrapolatedGradientSection.sizer.add(this.extrapolatedGradientSmoothness_Control);
    extrapolatedGradientSection.sizer.addSpacing(20);
    extrapolatedGradientSection.sizer.add(extrapolatedGradientGraphButton);
    this.extrapolatedGradientBar = new SectionBar(this, "Extrapolated Gradient");
    this.extrapolatedGradientBar.setSection(extrapolatedGradientSection);
    this.extrapolatedGradientBar.enableCheckBox();
    this.extrapolatedGradientBar.toolTip = 
            "<p>The Extrapolated Gradient option corrects the relative gradient between the " +
            "reference and target frames. The applied gradient is based on the " +
            "gradient detected on the target side edge of either the overlap's bounding box " +
            "or, if 'Taper from join' is selected, the target side edge of the 'Join Region'. " +
            "It is applied from this edge to the rest of the target image. " +
            "It is not applied to the overlap area (this area is already fully corrected).<\p>" +
            "<p>Consider using this option if the reference image has less gradient " +
            "than the target. In these cases it can correct either the " +
            "horizontal or vertical components of the relative gradient between the " +
            "two images. If this option is used both when joining tiles into rows or " +
            "columns, and then when these strips are joined, both components of " +
            "the relative gradient will be applied.</p>";
    this.extrapolatedGradientBar.checkBox.onClick = this.setExtrapolateGradientFlag;
    this.extrapolatedGradientBar.onToggleSection = this.onToggleSection;
    this.setExtrapolateGradientFlag(data.extrapolatedGradientFlag);
    // SectionBar: "Propagated Gradient Correction" End
    
    // =======================================
    // SectionBar: "Mosaic Star Mask"
    // =======================================
    let starMaskLabelSize = this.font.width("Multiply star radius:");
    this.LimitMaskStars_Control = new NumericControl(this);
    this.LimitMaskStars_Control.real = false;
    this.LimitMaskStars_Control.label.text = "Limit stars %:";
    this.LimitMaskStars_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to " +
            "create the star mask.</p>" +
            "<p>0% will produce a solid mask with no stars.<br />" +
            "100% will produce a mask that includes all detected stars.</p>" +
            "<p>Small faint stars are usually free of artifacts, so normally " +
            "only a small percentage of the detected stars need to be used.</p>";
    this.LimitMaskStars_Control.label.setFixedWidth(starMaskLabelSize);
    this.LimitMaskStars_Control.setRange(0, 100);
    this.LimitMaskStars_Control.slider.setRange(0, 100);
    this.LimitMaskStars_Control.slider.minWidth = 200;
    this.LimitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    this.LimitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
    };
    
    this.maskStarRadiusMult_Control = new NumericControl(this);
    this.maskStarRadiusMult_Control.real = true;
    this.maskStarRadiusMult_Control.label.text = "Multiply star radius:";
    this.maskStarRadiusMult_Control.toolTip =
            "<p>Increases the size of the brightest stars.</p>" +
            "<p>It mainly affects stars that are saturated or close to saturation.</p>";
    this.maskStarRadiusMult_Control.label.setFixedWidth(starMaskLabelSize);
    this.maskStarRadiusMult_Control.setRange(1, 25);
    this.maskStarRadiusMult_Control.slider.setRange(1, 250);
    this.maskStarRadiusMult_Control.setPrecision(1);
    this.maskStarRadiusMult_Control.slider.minWidth = 250;
    this.maskStarRadiusMult_Control.setValue(data.maskStarRadiusMult);
    this.maskStarRadiusMult_Control.onValueUpdated = function (value) {
        data.maskStarRadiusMult = value;
    };
    
    this.maskStarRadiusAdd_Control = new NumericControl(this);
    this.maskStarRadiusAdd_Control.real = true;
    this.maskStarRadiusAdd_Control.label.text = "Add to star radius:";
    this.maskStarRadiusAdd_Control.toolTip =
            "<p>Used to increases or decreases the radius of all mask stars.</p>" +
            "<p>This is applied after the 'Multiply star radius'.</p>";
    this.maskStarRadiusAdd_Control.label.setFixedWidth(starMaskLabelSize);
    this.maskStarRadiusAdd_Control.setRange(0, 10);
    this.maskStarRadiusAdd_Control.slider.setRange(0, 100);
    this.maskStarRadiusAdd_Control.setPrecision(1);
    this.maskStarRadiusAdd_Control.slider.minWidth = 100;
    this.maskStarRadiusAdd_Control.setValue(data.maskStarRadiusAdd);
    this.maskStarRadiusAdd_Control.onValueUpdated = function (value) {
        data.maskStarRadiusAdd = value;
    };
    
    let createMaskButton = new PushButton();
    createMaskButton.text = "Create mask";
    createMaskButton.toolTip =
            "<p>Creates a star mask that reveals bright stars.</p>" +
            "<p>It is often difficult to match bright stars without creating " +
            "artifacts. Stars within the overlapping region can be fixed by " +
            "using PixelMath to apply the reference image to the mosaic through " +
            "a mask. This mask is designed for this purpose.</p>";
    createMaskButton.onClick = function () {
        data.viewFlag = CREATE_MOSAIC_MASK();
        this.dialog.ok();
    };
    
    let maskStarsButton = new PushButton();
    maskStarsButton.text = "Stars";
    maskStarsButton.toolTip =
            "<p>Displays the stars used to create the mosaic star mask.</p>";
    maskStarsButton.onClick = function () {
        data.viewFlag = DISPLAY_MOSAIC_MASK_STARS();
        this.dialog.ok();
    };
    
    let mask_Sizer = new HorizontalSizer;
    mask_Sizer.spacing = 4;
    mask_Sizer.addStretch();
    mask_Sizer.add(createMaskButton);
    mask_Sizer.addSpacing(2);
    mask_Sizer.add(maskStarsButton);
    
    
    let starMaskSection = new Control(this);
    starMaskSection.sizer = new VerticalSizer;
    starMaskSection.sizer.spacing = 4;
    starMaskSection.sizer.add(this.LimitMaskStars_Control);
    starMaskSection.sizer.add(this.maskStarRadiusMult_Control);
    starMaskSection.sizer.add(this.maskStarRadiusAdd_Control);
    starMaskSection.sizer.add(mask_Sizer);
    let starMaskBar = new SectionBar(this, "Mosaic Star Mask");
    starMaskBar.setSection(starMaskSection);
    starMaskBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Mosaic Star Mask" End

    // =======================================
    // SectionBar: "Create Mosaic"
    // =======================================
    let overlay_Label = new Label(this);
    overlay_Label.text = "Combination mode:";
    overlay_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    overlay_Label.minWidth = this.font.width("Overlay:");
    
    this.mosaicOverlayTgtControl = new RadioButton(this);
    this.mosaicOverlayTgtControl.text = "Overlay";
    this.mosaicOverlayTgtControl.toolTip =
            "<p>On the target side of the join path, target pixels are drawn " +
            "on top of the reference. On the reference side, reference pixels " +
            "are drawn on top.</p>";
    this.mosaicOverlayTgtControl.checked = data.mosaicOverlayTgtFlag;
    this.mosaicOverlayTgtControl.onClick = function (checked) {
        data.mosaicOverlayTgtFlag = checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };

    this.mosaicRandomControl = new RadioButton(this);
    this.mosaicRandomControl.text = "Random";
    this.mosaicRandomControl.toolTip = "<p>Over the join region, pixels " +
            "are randomly chosen from the reference and target images.</p>" +
            "<p>This mode is particularly affective at hiding the join, but if " +
            "the star profiles in the reference and target images don't match, " +
            "this can lead to speckled pixels around the stars.</p>" +
            "<p>These speckled star artifacts can be fixed by using PixelMath " +
            "to apply either the reference or target image to the mosaic through " +
            "a mask that only reveals the bright stars. The 'Mosaic Star Mask' " +
            "section has been provided for this purpose.</p>";
    this.mosaicRandomControl.checked = data.mosaicRandomFlag;
    this.mosaicRandomControl.onClick = function (checked) {
        data.mosaicRandomFlag = checked;
        data.mosaicOverlayTgtFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };
    this.mosaicAverageControl = new RadioButton(this);
    this.mosaicAverageControl.text = "Average";
    this.mosaicAverageControl.toolTip = "<p>Over the join region, " +
            "pixels are set to the average of the reference and target pixels.</p>" +
            "<p>This mode has the advantage of increasing the signal to noise ratio " +
            "over the join, but this can also make the join more visible.</p>";
    this.mosaicAverageControl.checked = data.mosaicAverageFlag;
    this.mosaicAverageControl.onClick = function (checked) {
        data.mosaicAverageFlag = checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicOverlayTgtFlag = !checked;
    };
    
    this.setCreateMosaicFlag = function(checked){
        self.mosaicBar.checkBox.checked = checked;
        data.createMosaicFlag = checked;
        mosaicSection.enabled = checked;
    };
    
    let joinMaskButton = new PushButton();
    joinMaskButton.text = "Join mask";
    joinMaskButton.toolTip =
            "<p>Creates a mask of the mosaic join. " +
            "This mask indicates the pixels used to create the mosaic join.</p>" +
            "<p>If a 'Join Region' has not been defined, the join area is " +
            "simply the overlapping pixels. However, if it has been specified, " +
            "the join extends along the full length of the join but it is " +
            "otherwise limited to the 'Join Region'.</p>";
    joinMaskButton.onClick = function () {
        data.viewFlag = CREATE_JOIN_MASK();
        this.dialog.ok();
    };
    
    let mosaicSection = new Control(this);
    mosaicSection.sizer = new HorizontalSizer;
    mosaicSection.sizer.spacing = 10;
    mosaicSection.sizer.add(overlay_Label);
    mosaicSection.sizer.add(this.mosaicOverlayTgtControl);
    mosaicSection.sizer.add(this.mosaicRandomControl);
    mosaicSection.sizer.add(this.mosaicAverageControl);
    mosaicSection.sizer.addStretch();
    mosaicSection.sizer.add(joinMaskButton);
    this.mosaicBar = new SectionBar(this, "Create Mosaic");
    this.mosaicBar.setSection(mosaicSection);
    this.mosaicBar.enableCheckBox();
    this.mosaicBar.toolTip = "<p>If selected, the reference and target frames are " +
            "combined and displayed in a window named: '" + MOSAIC_NAME() + "'</p>" +
            "<p>Otherwise, the corrections will still be " +
            "applied to a copy of the target image, but the mosaic is not created.</p>";
    this.mosaicBar.checkBox.onClick = this.setCreateMosaicFlag;
    this.mosaicBar.onToggleSection = this.onToggleSection;
    this.setCreateMosaicFlag(data.createMosaicFlag);
    // SectionBar: "Create Mosaic" End
    

    const helpWindowTitle = TITLE() + " Help";
    const HELP_MSG =
            "<p>To install this script, use 'SCRIPT \> Feature Scripts...' and then in the " +
            "'Feature Scripts' dialog box, press the 'Add' button and select the folder " +
            "where you unzipped this script.</p>" +
            "<p>To install the help files, unzip 'PhotometricMosaicHelp.zip' to " +
            "'[PixInsight]/doc/scripts/'</p>" +
            "<p>For example, on Windows, the correct installation would include:</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/PhotometricMosaic.html</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/images/</p>";
    
    let okTooltip = "<p>Applies the calculated scale and gradient to a copy of the target image.</p>" +
            "<p>If 'Create Mosaic' is selected, a mosaic image is created and displayed.</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, 
            helpWindowTitle, HELP_MSG, "PhotometricMosaic", okTooltip);

    //---------------------------------------------------------------
    // Vertically stack all the SectionBars and OK/Cancel button bar
    //---------------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleBar);
    this.sizer.add(titleSection);
    this.sizer.add(selectViewBar);
    this.sizer.add(selectViewSection);
    this.sizer.add(starDetectionBar);
    this.sizer.add(starDetectionSection);
    this.sizer.add(photometrySearchBar);
    this.sizer.add(photometrySearchSection);
    this.sizer.add(photometryBar);
    this.sizer.add(photometrySection);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(this.joinAreaBar);
    this.sizer.add(joinAreaSection);
    this.sizer.add(this.joinSizeBar);
    this.sizer.add(joinSizeSection);
    this.sizer.add(gradientBar);
    this.sizer.add(overlapGradientSection);
    this.sizer.add(this.extrapolatedGradientBar);
    this.sizer.add(extrapolatedGradientSection);
    this.sizer.add(starMaskBar);
    this.sizer.add(starMaskSection);
    this.sizer.add(this.mosaicBar);
    this.sizer.add(mosaicSection);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);
    
    starDetectionSection.hide();
    photometrySearchSection.hide();
    joinAreaSection.hide();
    joinSizeSection.hide();
    sampleGenerationSection.hide();
    extrapolatedGradientSection.hide();
    starMaskSection.hide();

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
PhotometricMosaicDialog.prototype = new Dialog;

// Photometric Mosaic main process
function main() {
//    GradientTest();

    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: There must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new PhotometricMosaicData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new PhotometricMosaicDialog(data);
    for (; ; ) {
        data.viewFlag = 0;
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.abortEnabled = false; // Allowing abort would complicate cache strategy
        console.writeln("\n\n=== <b>" + TITLE() + " ", VERSION(), "</b> ===");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.referenceView.isNull) {
            (new MessageBox("WARNING: Reference view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.isColor !== data.referenceView.image.isColor) {
            (new MessageBox("ERROR: Both images must have the same color depth", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.hasJoinAreaPreview){
            if (data.joinAreaPreviewRect.x1 > data.targetView.image.width || 
                    data.joinAreaPreviewRect.y1 > data.referenceView.image.height){
                (new MessageBox("ERROR: Join Region Preview extends beyond the edge of the image\n" +
                "Have you selected the wrong preview?", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
                continue;
            }
        }
        if (data.targetView.fullId === data.referenceView.fullId) {
            (new MessageBox("ERROR: Target and Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.extrapolatedGradientFlag && data.extrapolatedGradientSmoothness < data.overlapGradientSmoothness){
            (new MessageBox("Extrapolated Gradient Smoothness must be less than or equal to Overlap Area Gradient Smoothness", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.createMosaicFlag && data.cropTargetToJoinRegionFlag && data.mosaicRandomFlag){
            (new MessageBox("Valid mosaic combination modes for the 'Crop target' option are\nOverlay and Average", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        photometricMosaic(data);
        data.saveParameters();  // Save script parameters to the newly created mosaic window.
        console.hide();
    }
    
    return;
}
