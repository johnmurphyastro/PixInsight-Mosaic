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
    let isGoodChoice = function(view){
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
        Parameters.set("joinAreaPreview_X0", this.joinAreaPreview_X0);
        Parameters.set("joinAreaPreview_Y0", this.joinAreaPreview_Y0);
        Parameters.set("joinAreaPreview_X1", this.joinAreaPreview_X1);
        Parameters.set("joinAreaPreview_Y1", this.joinAreaPreview_Y1);
        
        // Gradient Sample Generation
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("maxSamples", this.maxSamples);
        Parameters.set("orientation", this.orientation);
        
        // Gradient Tapered Correction
        Parameters.set("gradientSmoothness", this.gradientSmoothness);
        Parameters.set("taperLength", this.taperLength);
        
        // Gradient Propagated Correction
        Parameters.set("propagateFlag", this.propagateFlag);
        Parameters.set("propagateSmoothness", this.propagateSmoothness);
        
        // Mosaic Star Mask
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("multiplyStarRadius", this.radiusMult);
        Parameters.set("addStarRadius", this.radiusAdd);
        
        // Create Mosaic
        Parameters.set("createMosaicFlag", this.createMosaicFlag);
        Parameters.set("mosaicOverlayRefFlag", this.mosaicOverlayRefFlag);
        Parameters.set("mosaicOverlayTgtFlag", this.mosaicOverlayTgtFlag);
        Parameters.set("mosaicRandomFlag", this.mosaicRandomFlag);
        Parameters.set("mosaicAverageFlag", this.mosaicAverageFlag); 
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
        if (Parameters.has("hasJoinAreaPreview"))
            this.hasJoinAreaPreview = Parameters.getBoolean("hasJoinAreaPreview");
        if (Parameters.has("joinAreaPreview_X0")){
            this.joinAreaPreview_X0 = Parameters.getInteger("joinAreaPreview_X0");
        }
        if (Parameters.has("joinAreaPreview_Y0")){
            this.joinAreaPreview_Y0 = Parameters.getInteger("joinAreaPreview_Y0");
        }
        if (Parameters.has("joinAreaPreview_X1")){
            this.joinAreaPreview_X1 = Parameters.getInteger("joinAreaPreview_X1");
        }
        if (Parameters.has("joinAreaPreview_Y1")){
            this.joinAreaPreview_Y1 = Parameters.getInteger("joinAreaPreview_Y1");
        }
        
        // Gradient Sample Generation
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("maxSamples"))
            this.maxSamples = Parameters.getInteger("maxSamples");   
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        
        // Gradient Tapered Correction
        if (Parameters.has("gradientSmoothness"))
            this.gradientSmoothness = Parameters.getReal("gradientSmoothness");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
        
        // Gradient Propagated Correction
        if (Parameters.has("propagateFlag"))
            this.propagateFlag = Parameters.getBoolean("propagateFlag");
        if (Parameters.has("propagateSmoothness"))
            this.propagateSmoothness = Parameters.getReal("propagateSmoothness");
        
        // Mosaic Star Mask
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("multiplyStarRadius"))
            this.radiusMult = Parameters.getReal("multiplyStarRadius");
        if (Parameters.has("addStarRadius"))
            this.radiusAdd = Parameters.getReal("addStarRadius");
        
        // Create Mosaic
        if (Parameters.has("createMosaicFlag"))
            this.createMosaicFlag = Parameters.getBoolean("createMosaicFlag");
        if (Parameters.has("mosaicOverlayRefFlag"))
            this.mosaicOverlayRefFlag = Parameters.getBoolean("mosaicOverlayRefFlag");
        if (Parameters.has("mosaicOverlayTgtFlag"))
            this.mosaicOverlayTgtFlag = Parameters.getBoolean("mosaicOverlayTgtFlag");
        if (Parameters.has("mosaicRandomFlag"))
            this.mosaicRandomFlag = Parameters.getBoolean("mosaicRandomFlag");
        if (Parameters.has("mosaicAverageFlag"))
            this.mosaicAverageFlag = Parameters.getBoolean("mosaicAverageFlag");
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
        this.joinAreaPreview_X0 = 0;
        this.joinAreaPreview_Y0 = 0;
        this.joinAreaPreview_X1 = 0;
        this.joinAreaPreview_Y1 = 0;
        
        // Gradient Sample Generation
        this.limitSampleStarsPercent = 10;
        this.sampleSize = 15;
        this.maxSamples = 2000;
        this.orientation = AUTO();
        
        // Gradient Tapered Correction
        this.gradientSmoothness = -1.5;
        this.taperLength = 500;
        
        // Gradient Propagated Correction
        this.propagateFlag = false;
        this.propagateSmoothness = 3;
        
        // Mosaic Star Mask
        this.limitMaskStarsPercent = 10;
        this.radiusMult = 2.5;
        this.radiusAdd = -1;
        
        // Create Mosaic
        this.createMosaicFlag = true;
        this.mosaicOverlayRefFlag = true;
        this.mosaicOverlayTgtFlag = false;
        this.mosaicRandomFlag = false;
        this.mosaicAverageFlag = false;
        
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
        linearFitDialog.rectangleX0_Control.setValue(this.joinAreaPreview_X0);
        linearFitDialog.rectangleY0_Control.setValue(this.joinAreaPreview_Y0);
        linearFitDialog.rectangleX1_Control.setValue(this.joinAreaPreview_X1);
        linearFitDialog.rectangleY1_Control.setValue(this.joinAreaPreview_Y1);
        linearFitDialog.setHasJoinAreaPreview(this.hasJoinAreaPreview);
        
        // Gradient Sample Generation
        linearFitDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.orientationCombo.currentItem = AUTO();
        
        // Gradient Tapered Correction
        linearFitDialog.gradientSmoothnessControl.setValue(this.gradientSmoothness);
        linearFitDialog.taperLength_Control.setValue(this.taperLength);
        
        // Gradient Propagated Correction
        linearFitDialog.propagateSmoothness_Control.setValue(this.propagateSmoothness);
        linearFitDialog.setPropagateGradientFlag(this.propagateFlag);
        
        // Mosaic Star Mask
        linearFitDialog.LimitMaskStars_Control.setValue(this.limitMaskStarsPercent);
        linearFitDialog.StarRadiusMultiply_Control.setValue(this.radiusMult);
        linearFitDialog.StarRadiusAdd_Control.setValue(this.radiusAdd);
        
        // Create Mosaic
        linearFitDialog.setCreateMosaicFlag(this.createMosaicFlag);
        linearFitDialog.mosaicOverlayRefControl.checked = this.mosaicOverlayRefFlag;
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
            "(1) Each join must be approximately vertical or horizontal.<br />" +
            "(2) Join frames into either columns or rows.<br />" +
            "(3) Join these strips to create the final mosaic.<br />" +
            "Copyright &copy; 2019-2020 John Murphy.");
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
    referenceImage_Label.text = "Reference View:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = OUTLIER_REMOVAL_STRLEN;
    referenceImage_Label.toolTip = "<p>The reference image. This image will not be modified.</p>";

    let referenceImage_ViewList = new ViewList(this);
    referenceImage_ViewList.getMainViews();
    referenceImage_ViewList.minWidth = 300;
    if (data.referenceView !== null){
        referenceImage_ViewList.currentView = data.referenceView;
    }
    referenceImage_ViewList.toolTip = 
            "<p>The reference image. This image will not be modified.</p>";
    referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };

    let referenceImage_Sizer = new HorizontalSizer;
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(referenceImage_ViewList, 100);

    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target View:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = OUTLIER_REMOVAL_STRLEN;
    targetImage_Label.toolTip = "<p>This image is cloned, then multiplied by " +
            "the photometrically determined scale factor, and finally the gradient " +
            "is calculated and subtracted.</p>";

    let targetImage_ViewList = new ViewList(this);
    targetImage_ViewList.getMainViews();
    targetImage_ViewList.minWidth = 300;
    if (data.targetView !== null){
        targetImage_ViewList.currentView = data.targetView;
    }
    targetImage_ViewList.toolTip = "<p>This image is cloned, then multiplied by " +
            "the photometrically determined scale factor, and finally the gradient " +
            "is calculated and subtracted.</p>";
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
    this.starDetectionControl.label.text = "Star Detection:";
    this.starDetectionControl.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.starDetectionControl.toolTip = "<p>Smaller values detect more stars.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starDetectionControl.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetectionControl.setRange(-2, 2);
    this.starDetectionControl.slider.setRange(0, 50);
    this.starDetectionControl.slider.minWidth = 50;
    this.starDetectionControl.setValue(data.logStarDetection);
    
    let detectedStarsButton = new PushButton();
    detectedStarsButton.text = "Detected Stars";
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
            this.font.width("Star Flux Tolerance:"), 
            this.font.width("Star Search Radius:"));
    this.starFluxTolerance_Control = new NumericControl(this);
    this.starFluxTolerance_Control.real = true;
    this.starFluxTolerance_Control.label.text = "Star Flux Tolerance:";
    this.starFluxTolerance_Control.toolTip = 
            "<p>Although the target and reference images have been registered, the star "  +
            "centers can still differ by a few pixels and need to be matched.</p>" +
            "<p>Star flux tolerance is used to prevent invalid star matches. " +
            "Smaller values reject more matches. " +
            "You usually don't need to modify this parameter.</p>" +
            "<p>Star matches are rejected if the difference in star flux " +
            "is larger than expected. The algorithm first calculates the average scale difference, " +
            "and then rejects matches if their brightness ratio is greater than " +
            "(expected ratio * tolerance) or smaller than (expected ratio / tolerance)</p>" +
            "<p>1.0 implies the star flux ratio must exactly match the expected ratio.</p>" +
            "<p>2.0 implies that the ratio can be double or half the expected ratio.</p>";
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
    this.starSearchRadius_Control.label.text = "Star Search Radius:";
    this.starSearchRadius_Control.toolTip = 
            "<p>Although the target and reference images have been registered, the star "  +
            "centers can still differ by a few pixels so it is necessary to match " +
            "the reference and target stars.</p>" +
            "<p>Search radius is used to match the reference and target stars. " +
            "Larger values find more photometric stars but at the risk of matching " +
            "the wrong star or even matching noise. " +
            "You usually don't need to modify this parameter.</p>";
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
    this.limitPhotoStarsPercent_Control.label.text = "Limit Stars %:";
    this.limitPhotoStarsPercent_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.limitPhotoStarsPercent_Control.toolTip = 
            "<p>Specifies the percentage of detected stars that will be used to " +
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
    this.rejectHigh_Control.label.text = "Linear Range:";
    this.rejectHigh_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.rejectHigh_Control.toolTip = 
            "<p>This control restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value. " +
            "This ensures the photometric stars are within the " +
            "camera's linear response range.</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.linearRange = value;
    };
    this.rejectHigh_Control.setRange(0.01, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 500);
    this.rejectHigh_Control.setPrecision(2);
    this.rejectHigh_Control.slider.minWidth = 206;
    this.rejectHigh_Control.setValue(data.linearRange);

    let photometricScaleHorizSizer1 = new HorizontalSizer;
    photometricScaleHorizSizer1.spacing = 4;
    photometricScaleHorizSizer1.add(this.rejectHigh_Control);
    photometricScaleHorizSizer1.addStretch();
    
    this.outlierRemoval_Control = new NumericControl(this);
    this.outlierRemoval_Control.real = false;
    this.outlierRemoval_Control.label.text = "Outlier Removal:";
    this.outlierRemoval_Control.label.minWidth = OUTLIER_REMOVAL_STRLEN;
    this.outlierRemoval_Control.toolTip = 
            "<p>The photometric measurement of some stars can be suspect. " +
            "For example, the area around the star that's used to calculate " +
            "the background level may contain too many bright pixels. " +
            "This control determines the number of outlier stars to remove. " +
            "This can improve accuracy, but don't over do it!</p>" +
            "<p>Use the 'Photometry Graph' button to see the " +
            "photometry data points and their best fit line.</p>";
    this.outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
    };
    this.outlierRemoval_Control.setRange(0, 50);
    this.outlierRemoval_Control.slider.setRange(0, 50);
    this.outlierRemoval_Control.slider.minWidth = 220;
    this.outlierRemoval_Control.setValue(data.outlierRemoval);
    
    let photometryGraphButton = new PushButton();
    photometryGraphButton.text = "Photometry Graph";
    photometryGraphButton.toolTip = 
            "<p>For each star detected within the overlapping region, " +
            "if the star meets the photometry criteria, the star's reference flux " +
            "is plotted against its target flux.</p>" +
            "<p>Color (red, green and blue) is used to represent the data for each color channel.</p>" +
            "<p>The plotted lines indicate the " +
            "best fit lines (least squares fit) that go through the origin. " +
            "The gradient of these lines gives the required scale factors. </p>" +
            "<p>See graph title bar for usage hints.</p>";
    photometryGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_PHOTOMETRY_GRAPH();
        this.dialog.ok();
    };
    
    let photometryStarsButton = new PushButton();
    photometryStarsButton.text = "Photometry Stars";
    photometryStarsButton.toolTip = 
            "<p>Displays the stars that met the criteria for photometry. " +
            "These stars were within the specified 'Linear Range' and were found " +
            "in both target and reference images and not rejected by 'Outlier Removal'.</p>" +
            "<p>The color represents the color channel. " +
            "Hence a white square indicates the star was found in the red, green and blue channels.</p>" +
            "<p>Useful data is also saved to the graph's FITS header, " +
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
    // SectionBar: "Join Region"
    // =======================================
    const getAreaFromPreviewStr = "Get area from preview:";
    const GET_AREA_FROM_PREVIEW_STRLEN = this.font.width(getAreaFromPreviewStr);
    const JoinRegionTooltip =
            "<p>The 'Join Region' determines the size and position of the join between the two images. " +
            "If this option is not selected, the whole overlap region is used for the join.</p>" +
            "<p>For a 'Random' join, use a thin rectangle just thick enough to blend the two sides of the join. " +
            "Position the rectangle to avoid image corners and bright stars.</p>" +
            "<p>For a 'Reference' overlay join, the rectangle side closest to the target image determines " +
            "the join line. For a 'Target' overlay join, it is the side closest to the reference image. " +
            "The join position should avoid image corners and bright stars.</p>" +
            "<p>It is not necessary for the selected area to contain any stars. The whole of the " +
            "overlap region is always used to determine the photometric scale and the background gradient.</p>" +
            "<p>If the 'Join Direction' mode is 'Auto', 'Horizontal' or 'Vertical', the join " +
            "rectangle's length is updated to start and finish at the overlap bounding box.</p>";
            
    this.rectangleX0_Control = createNumericEdit("Left:", JoinRegionTooltip,
            data.joinAreaPreview_X0, 50);
    this.rectangleX0_Control.label.setFixedWidth(
            GET_AREA_FROM_PREVIEW_STRLEN + this.font.width("Left:") + 20);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.joinAreaPreview_X0 = value;
    };
    this.rectangleY0_Control = createNumericEdit("Top:", JoinRegionTooltip,
            data.joinAreaPreview_Y0, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.joinAreaPreview_Y0 = value;
    };
    this.rectangleX1_Control = createNumericEdit("Right:", JoinRegionTooltip,
            data.joinAreaPreview_X1, 50);
    this.rectangleX1_Control.onValueUpdated = function (value){
        data.joinAreaPreview_X1 = value;
    };
    this.rectangleY1_Control = createNumericEdit("Bottom:", JoinRegionTooltip,
            data.joinAreaPreview_Y1, 50);
    this.rectangleY1_Control.onValueUpdated = function (value){
        data.joinAreaPreview_Y1 = value;
    };

    let joinAreaHorizSizer1 = new HorizontalSizer;  
    joinAreaHorizSizer1.spacing = 10;
    joinAreaHorizSizer1.add(this.rectangleX0_Control);
    joinAreaHorizSizer1.add(this.rectangleY0_Control);
    joinAreaHorizSizer1.add(this.rectangleX1_Control);
    joinAreaHorizSizer1.add(this.rectangleY1_Control);
    joinAreaHorizSizer1.addStretch();

    let previewUpdateActions = function(dialog){
        let view = dialog.previewImage_ViewList.currentView;
        if (view !== null && view.isPreview) {
            dialog.joinAreaBar.checkBox.checked = data.hasJoinAreaPreview;
            ///let imageWindow = view.window;
            let rect = view.window.previewRect(view);
            data.joinAreaPreview_X0 = rect.x0;
            data.joinAreaPreview_Y0 = rect.y0;
            data.joinAreaPreview_X1 = rect.x1;
            data.joinAreaPreview_Y1 = rect.y1;

            dialog.rectangleX0_Control.setValue(data.joinAreaPreview_X0);
            dialog.rectangleY0_Control.setValue(data.joinAreaPreview_Y0);
            dialog.rectangleX1_Control.setValue(data.joinAreaPreview_X1);
            dialog.rectangleY1_Control.setValue(data.joinAreaPreview_Y1);
            
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
    this.previewImage_ViewList.toolTip = "<p>Get the 'Join Region' from a preview image.</p>";
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
        self.rectangleX1_Control.enabled = checked;
        self.rectangleY0_Control.enabled = checked;
        self.rectangleY1_Control.enabled = checked;
    };
    
    let joinAreaSection = new Control(this);
    joinAreaSection.sizer = new VerticalSizer;
    joinAreaSection.sizer.spacing = 4;
    joinAreaSection.sizer.add(joinAreaHorizSizer1);
    joinAreaSection.sizer.add(joinAreaHorizSizer2);
    this.joinAreaBar = new SectionBar(this, "Join Region");
    this.joinAreaBar.setSection(joinAreaSection);
    this.joinAreaBar.enableCheckBox();
    this.joinAreaBar.checkBox.toolTip = JoinRegionTooltip;
    this.joinAreaBar.checkBox.onClick = this.setHasJoinAreaPreview;
    this.joinAreaBar.onToggleSection = this.onToggleSection;
    this.setHasJoinAreaPreview(data.hasJoinAreaPreview);
    // SectionBar "Join Region" End

    // =======================================
    // SectionBar: "Gradient"
    // =======================================
    // GroupBox: "Gradient Sample Generation"
    // ---------------------------------------
    const joinDirectionStrLen = this.font.width("Join Direction:");
    this.limitSampleStarsPercent_Control = new NumericControl(this);
    this.limitSampleStarsPercent_Control.real = true;
    this.limitSampleStarsPercent_Control.label.text = "Limit Stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = joinDirectionStrLen;
    this.limitSampleStarsPercent_Control.toolTip = 
            "<p>Specifies the percentage of detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. This can effect how many of the " +
            "pixels illuminated by a star fall into a neighboring sample.</li></ul>" +
            "<p>It is not necessary to reject all faint stars. This script uses the " +
            "median value from each sample, so any star that takes up less than " +
            "half the sample area will have little effect. These samples do not " +
            "have to be rejected.</p>";
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    this.limitSampleStarsPercent_Control.setRange(0, 100);
    this.limitSampleStarsPercent_Control.slider.setRange(0, 100);
    this.limitSampleStarsPercent_Control.setPrecision(0);
    this.limitSampleStarsPercent_Control.slider.minWidth = 200;
    this.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);
    
    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = true;
    this.sampleSize_Control.label.text = "Sample Size:";
    this.sampleSize_Control.label.minWidth = joinDirectionStrLen;
    this.sampleSize_Control.toolTip = 
            "<p>Specifies the size of the sample squares.</p>" +
            "<p>The overlapping region is divided up into a grid of sample squares. " +
            "A sample's value is the median of the pixels it contains. " +
            "These sample values are used to calculate the background offset and gradient. " +
            "Using samples ensures that the offset and gradient calculation is " +
            "less affected by bright stars with differing FWHM sizes.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star bright enough to be included " +
            "in the 'Limit Stars %' list.</p>" +
            "<p>Ideally, the samples should be about 1.5x the size of the largest star.</p>" +
            "<p>The samples are used to create a surface spline that models the " +
            "background gradient. The sample size and the number of samples not " +
            "rejected by stars will determine the maximum resolution of the surface spline. " +
            "However, very small samples will suffer from noise.</p>" +
            "<p>For performance reasons, if there are more than 2,000 samples, the " +
            "samples are binned before creating the surface spline.</p>" +
            "<p>Use the 'Sample Grid' button to visualize the grid of samples.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(3, 50);
    this.sampleSize_Control.slider.setRange(3, 50);
    this.sampleSize_Control.setPrecision(0);
    this.sampleSize_Control.slider.minWidth = 200;
    this.sampleSize_Control.setValue(data.sampleSize);
    
    let directionLabel = new Label(this);
    directionLabel.text = "Join Direction:";
    directionLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    directionLabel.minWidth = joinDirectionStrLen;
    
    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = 
        "<p>Orientation of the line of intersection. This determines how the " +
        "background offset is corrected outside of the overlap region: " +
        "<ul><li>In the direction parallel to the join, the offset is held constant either side of the join</li>" +
        "<li>In the direction perpendicular to the join, the correction is dependent on the " +
        "'Propagated Gradient Correction' and 'Tapered Gradient Correction' settings.</li></ul></p>" +
        "<p>The 'Horizontal' and 'Vertical' modes can be used to force the orientation, " +
        "but it is usually better to create a  long thin join area in the 'Join Region' section and " +
        "use 'Auto' instead.</p>" +
        "<p>The 'Auto' mode usually works well. It first looks at the specified 'Join Region' " +
         "rectangle, or if this is not specified, the overlap region. " +
        "If the area is wider than it is tall, the line of intersection " +
        "is assumed to be horizontal; if not, a vertical join.</p>" +         
        "<p>The 'Insert' mode is used to insert a target image into the middle of a mosaic. " +
        "Pixels from the target image are limited to the Join Region or overlap area. This can be used to fix a " +
        "small area of the mosaic or to add high res images to a wider mosaic.</p>";

    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.addItem("Insert");
    this.orientationCombo.addItem("Auto");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
    };
    
    let displaySamplesButton = new PushButton();
    displaySamplesButton.text = "Sample Grid";
    displaySamplesButton.toolTip = 
            "<p>Displays the grid of samples that will " +
            "be used to calculate the background offset and gradient.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star included in the 'Limit Stars %' list. " +
            "The surviving samples are drawn as squares. The stars used to " +
            "reject samples are indicated by circles.</p>";
    displaySamplesButton.onClick = function () {
        data.viewFlag = DISPLAY_GRADIENT_SAMPLES();
        this.dialog.ok();
    };
    
    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(directionLabel);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addStretch();
    orientationSizer.add(displaySamplesButton);
    
    let sampleGenerationGroupBox = createGroupBox(this, "Gradient Sample Generation");
    sampleGenerationGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    sampleGenerationGroupBox.sizer.add(this.sampleSize_Control);
    sampleGenerationGroupBox.sizer.add(orientationSizer);
    // GroupBox: "Gradient Sample Generation" End
    
    // ------------------------------------------
    // GroupBox: "Gradient Correction"
    // ------------------------------------------
    // Gradient controls
    this.gradientSmoothnessControl = new NumericControl(this);
    this.gradientSmoothnessControl.real = true;
    this.gradientSmoothnessControl.setPrecision(1);
    this.gradientSmoothnessControl.label.text = "Smoothness:";
    this.gradientSmoothnessControl.label.minWidth = this.font.width("Taper Length:");
    this.gradientSmoothnessControl.toolTip = 
        "<p>This mode applies a tapered correction to the gradient between " +
        "the reference and target image. This correction is applied after the " +
        "'Propagated Gradient Correction' (if specified).</p>" +
        "<p>The full correction is applied across the whole of the overlap's " +
        "bounding box. A taper is applied from the overlap's target side edge " +
        "to prevent the gradient correction propagating across the mosaic.</p>" +
        "<p>A tapered correction is ideal for correcting local difference, for " +
        "example, due to scattered light surrounding bright stars.</p>";
    this.gradientSmoothnessControl.onValueUpdated = function (value) {
        data.gradientSmoothness = value;
    };
    this.gradientSmoothnessControl.setRange(-4, 3);
    this.gradientSmoothnessControl.slider.setRange(-400, 300);
    this.gradientSmoothnessControl.slider.minWidth = 140;
    this.gradientSmoothnessControl.setValue(data.gradientSmoothness);
    
    let gradientGraphButton = new PushButton();
    gradientGraphButton.text = "Gradient Graph";
    gradientGraphButton.toolTip = 
        "<p>This graph displays the gradient data after the " +
        "'Propagated Gradient Correction' has been applied. It therefore " +
        "displays the residual error that still needs correcting.</p>" +
        "<p>The vertical axis represents the difference between the two images. " +
        "The horizontal axis represents the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent the difference between each paired target and " +
        "reference sample within the whole of the overlap bounding box area. " +
        "These points are scattered vertically. This is partly due to gradients perpendicular to " +
        "the join, and partly due to noise.<\p>" +
        "<p>The two curves are calculated from the differences at either side " +
        "(top and bottom for horizontal join) of the " +
        "'Join Region' and indicate the gradient correction that will be " +
        "applied at the join between the reference and target images.</p>" +
        "<p>The graphs produced for color images use red, green and blue dots " +
        "and lines for each channel. The colors add together. " +
        "For example: red, green and blue add up to white.</p>";
    gradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    let taperTooltip = "<p>The gradient correction is gradually " +
            "tapered down over the taper length to the average offset difference. " +
            "This prevents the local gradient corrections required at the join from " +
            "propagating to the opposite edge of the target frame.</p>" +
            "<p>The correction applied to the target image is applied as a single " +
            "calculation, but in principle it can be thought of as three steps:</p>" +
            "<ul><li>The scale factor is applied to the whole of the target image. " +
            "'Taper Length' has no affect. </li>" +
            "<li>If selected, the 'Propagated Gradient Correction' is applied to the whole " +
            "of the target image. 'Taper Length' has no affect. </li>" +
            "<li>If 'Propagated Gradient Correction' was not selected, the " +
            "average offset between the two images is applied to the whole " +
            "of the target image. 'Taper Length' has no affect. </li>" +
            "<li>The horizontal (or vertical) component of the gradient is calculated " +
            "for the horizontal (or vertical) join. In the overlap region, the " +
            "full gradient correction is applied to the target image. On the target image's " +
             "side of the overlap, the applied " +
            "gradient correction is gradually reduce to zero.</li></ul></p>";
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Taper Length:";
    this.taperLength_Control.label.minWidth = this.font.width("Taper Length:");
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(0, 2000);
    this.taperLength_Control.slider.setRange(0, 400);
    this.taperLength_Control.slider.minWidth = 500;
    this.taperLength_Control.setValue(data.taperLength);
    
    let taperSizer = new HorizontalSizer;
    taperSizer.spacing = 4;
    taperSizer.add(this.gradientSmoothnessControl);
    taperSizer.addSpacing(20);
    taperSizer.add(gradientGraphButton);
    
    let gradientGroupBox = createGroupBox(this, "Gradient Correction");
    gradientGroupBox.sizer.add(taperSizer);
    gradientGroupBox.sizer.add(this.taperLength_Control);
    // GroupBox: "Tapered Gradient Correction" End
    

    let gradientSection = new Control(this);
    gradientSection.sizer = new VerticalSizer;
    gradientSection.sizer.spacing = 4;
    gradientSection.sizer.add(sampleGenerationGroupBox);
    gradientSection.sizer.add(gradientGroupBox);
    let gradientBar = new SectionBar(this, "Gradient");
    gradientBar.setSection(gradientSection);
    gradientBar.onToggleSection = this.onToggleSection;
    //SectionBar: "Gradient" End
    
    // =======================================
    // SectionBar: "Propagated Gradient Correction"
    // =======================================
    this.propagateSmoothness_Control = new NumericControl(this);
    this.propagateSmoothness_Control.real = true;
    this.propagateSmoothness_Control.setPrecision(1);
    this.propagateSmoothness_Control.label.text = "Smoothness:";
    this.propagateSmoothness_Control.toolTip = 
        "<p>This mode can be used to correct the horizontal and vertical components of the " +
        "relative gradient between the reference and target images. This is done " +
        "in two stages. One component is corrected when tiles are joined into " +
        "horizontal or vertical strips. The other component is corrected when " +
        "these strips are joined.</p>" +
        "<p>Use this mode if the reference tile has less gradient than the target tile.</p>" +
        "<p>Since this gradient correction is propagated across the mosaic, the " +
        "correction should follow the general trend. It should not attempt to " +
        "correct the local variations due to bright stars and other artifacts.</p>" +
        "<p>When using this option, you should usually also apply a " +
        "'Tapered Gradient Correction', to fix the residual gradient " +
        "due to the stars and artifacts.</p>" +
        "<p>Since the reference tile's gradient will be propagated across the mosaic, " +
        "consider using DBE as a final correction once the mosaic is complete.</p>";
    this.propagateSmoothness_Control.onValueUpdated = function (value) {
        data.propagateSmoothness = value;
    };
    this.propagateSmoothness_Control.setRange(-1, 6);
    this.propagateSmoothness_Control.slider.setRange(-100, 600);
    this.propagateSmoothness_Control.slider.minWidth = 140;
    this.propagateSmoothness_Control.setValue(data.propagateSmoothness);
    
    let propagateGradientGraphButton = new PushButton();
    propagateGradientGraphButton.text = "Gradient Graph";
    propagateGradientGraphButton.toolTip = 
            "<p>The vertical axis represents the difference between the two images, " +
            "the horizontal axis the join's X-Coordinate (horizontal join) " +
            "or Y-Coordinate (vertical join).</p>" +
            "<p>The plotted dots represent the difference between each paired target and " +
            "reference sample within the whole of the overlap bounding box area. " +
            "These points are scattered vertically. This is partly due to gradients perpendicular to " +
            "the join, and partly due to noise.<\p>" +
            "<p>The two curves are calculated from the differences at either side " +
            "(top and bottom for horizontal join) of the " +
            "overlap bonding box and indicate the gradient correction that will be " +
            "propagated from this boundary.</p>" +
            "<p>The graphs produced for color images use red, green and blue dots " +
            "and lines for each channel. The colors add together. " +
            "For example: red, green and blue add up to white.</p>";
    propagateGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_PROPAGATE_GRAPH();
        this.dialog.ok();
    };
    
    this.setPropagateGradientFlag = function (checked){
        data.propagateFlag = checked;
        self.propagateGradientBar.checkBox.checked = checked;
        self.propagateSmoothness_Control.enabled = checked;
        propagateGradientGraphButton.enabled = checked;
    };
    
    let propagateGradientSection = new Control(this);
    propagateGradientSection.sizer = new HorizontalSizer;
    propagateGradientSection.sizer.spacing = 10;
    propagateGradientSection.sizer.add(this.propagateSmoothness_Control);
    propagateGradientSection.sizer.addSpacing(20);
    propagateGradientSection.sizer.add(propagateGradientGraphButton);
    this.propagateGradientBar = new SectionBar(this, "Propagated Gradient Correction");
    this.propagateGradientBar.setSection(propagateGradientSection);
    this.propagateGradientBar.enableCheckBox();
    this.propagateGradientBar.toolTip = "<p>Enable 'Propagated Gradient Correction'.</p>";
    this.propagateGradientBar.checkBox.onClick = this.setPropagateGradientFlag;
    this.propagateGradientBar.onToggleSection = this.onToggleSection;
    this.setPropagateGradientFlag(data.propagateFlag);
    // SectionBar: "Propagated Gradient Correction" End
    
    // =======================================
    // SectionBar: "Mosaic Star Mask"
    // =======================================
    let starMaskLabelSize = this.font.width("Multiply Star Radius:");
    this.LimitMaskStars_Control = new NumericControl(this);
    this.LimitMaskStars_Control.real = false;
    this.LimitMaskStars_Control.label.text = "Limit Stars %:";
    this.LimitMaskStars_Control.toolTip =
            "<p>Specifies the percentage of detected stars that will be used to " +
            "create the star mask.</p>" +
            "<p>0% will produce a solid mask with no stars.<br />" +
            "100% will produce a mask that includes all detected stars.</p>" +
            "<p>Small faint stars are usually free of artifacts, so normally " +
            "only a small percentage of the detected stars need to be used.</p>";
    this.LimitMaskStars_Control.label.setFixedWidth(starMaskLabelSize);
    this.LimitMaskStars_Control.setRange(0, 100);
    this.LimitMaskStars_Control.slider.setRange(0, 100);
    this.LimitMaskStars_Control.setPrecision(0);
    this.LimitMaskStars_Control.slider.minWidth = 200;
    this.LimitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    this.LimitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
    };
    
    this.StarRadiusMultiply_Control = new NumericControl(this);
    this.StarRadiusMultiply_Control.real = true;
    this.StarRadiusMultiply_Control.label.text = "Multiply Star Radius:";
    this.StarRadiusMultiply_Control.toolTip = 
            "<p>Sets the mask star radius to a multiple of the star's radius.</p>" +
            "<p>This increases the size for large stars more than small ones.</p>";
    this.StarRadiusMultiply_Control.setRange(1, 5);
    this.StarRadiusMultiply_Control.slider.setRange(1, 150);
    this.StarRadiusMultiply_Control.setPrecision(1);
    this.StarRadiusMultiply_Control.slider.minWidth = 150;
    this.StarRadiusMultiply_Control.setValue(data.radiusMult);
    this.StarRadiusMultiply_Control.onValueUpdated = function (value) {
        data.radiusMult = value;
    };
    
    this.StarRadiusAdd_Control = new NumericControl(this);
    this.StarRadiusAdd_Control.real = true;
    this.StarRadiusAdd_Control.label.text = "Add to Star Radius:";
    this.StarRadiusAdd_Control.toolTip = 
            "<p>Used to increases or decreases the radius of all mask stars.</p>" +
            "<p>This is applied after the 'Multiply Star Radius'.</p>";
    this.StarRadiusAdd_Control.setRange(-5, 10);
    this.StarRadiusAdd_Control.slider.setRange(0, 150);
    this.StarRadiusAdd_Control.setPrecision(1);
    this.StarRadiusAdd_Control.slider.minWidth = 150;
    this.StarRadiusAdd_Control.setValue(data.radiusAdd);
    this.StarRadiusAdd_Control.onValueUpdated = function (value) {
        data.radiusAdd = value;
    };
    
    let radiusHorizontalSizer = new HorizontalSizer;
    radiusHorizontalSizer.spacing = 20;
    radiusHorizontalSizer.add(this.StarRadiusMultiply_Control);
    radiusHorizontalSizer.add(this.StarRadiusAdd_Control);
    //radiusHorizontalSizer.addStretch();
    
    
    let createMaskButton = new PushButton();
    createMaskButton.text = "Create Mask";
    createMaskButton.toolTip = 
            "<p>Creates a star mask that reveals bright stars.</p>" +
            "<p>A mosaic join using the 'Random' mode is highly affective, but " +
            "often produces a speckled pattern around bright stars. This " +
            "mask option is provided to help fix this.</p>";
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
    starMaskSection.sizer.add(radiusHorizontalSizer);
    starMaskSection.sizer.add(mask_Sizer);
    let starMaskBar = new SectionBar(this, "Mosaic Star Mask");
    starMaskBar.setSection(starMaskSection);
    starMaskBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Mosaic Star Mask" End

    // =======================================
    // SectionBar: "Create Mosaic"
    // =======================================
    let overlay_Label = new Label(this);
    overlay_Label.text = "Combination Mode:";
    overlay_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    overlay_Label.minWidth = this.font.width("Overlay:");

    this.mosaicOverlayRefControl = new RadioButton(this);
    this.mosaicOverlayRefControl.text = "Reference";
    this.mosaicOverlayRefControl.toolTip = 
            "<p>The reference image pixels are drawn on top of the target image.</p>";
    this.mosaicOverlayRefControl.checked = data.mosaicOverlayRefFlag;
    this.mosaicOverlayRefControl.onClick = function (checked) {
        data.mosaicOverlayRefFlag = checked;
        data.mosaicOverlayTgtFlag = !checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };
    
    this.mosaicOverlayTgtControl = new RadioButton(this);
    this.mosaicOverlayTgtControl.text = "Target";
    this.mosaicOverlayTgtControl.toolTip = 
            "<p>The target image pixels are drawn on top of the reference image.</p>";
    this.mosaicOverlayTgtControl.checked = data.mosaicOverlayTgtFlag;
    this.mosaicOverlayTgtControl.onClick = function (checked) {
        data.mosaicOverlayTgtFlag = checked;
        data.mosaicOverlayRefFlag = !checked;
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
        data.mosaicOverlayRefFlag = !checked;
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
        data.mosaicOverlayRefFlag = !checked;
        data.mosaicOverlayTgtFlag = !checked;
    };
    
    this.setCreateMosaicFlag = function(checked){
        self.mosaicBar.checkBox.checked = checked;
        data.createMosaicFlag = checked;
        mosaicSection.enabled = checked;
    };
    
    let joinMaskButton = new PushButton();
    joinMaskButton.text = "Join Mask";
    joinMaskButton.toolTip = 
            "<p>Create a mask of the mosaic join. " +
            "This mask indicates the pixels used to create the mosaic join.</p>" +
            "<p>If a 'Limit Gradient Sample Area' has not been defined, the join area is " +
            "simply the overlapping pixels. However, if it has been specified, " +
            "the join still extends along the full length of the join but it is " +
            "otherwise limited to the 'Limit Gradient Sample Area'.</p>";
    joinMaskButton.onClick = function () {
        data.viewFlag = CREATE_JOIN_MASK();
        this.dialog.ok();
    };
    
    let mosaicSection = new Control(this);
    mosaicSection.sizer = new HorizontalSizer;
    mosaicSection.sizer.spacing = 10;
    mosaicSection.sizer.add(overlay_Label);
    mosaicSection.sizer.add(this.mosaicOverlayRefControl);
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
            "'Feature Scripts' dialog box, press the 'Add' button and select the folder where you have saved this script.</p>" +
            "<p>To install the help files, copy the 'PhotometricMosaic' folder from the 'Help' folder to " +
            "'[PixInsight]/doc/scripts/PhotometricMosaic</p>" +
            "<p>For example, on Windows, the correct installation would be:</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/PhotometricMosaic.html</p>";
    
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
    this.sizer.add(this.joinAreaBar);
    this.sizer.add(joinAreaSection);
    this.sizer.add(gradientBar);
    this.sizer.add(gradientSection);
    this.sizer.add(this.propagateGradientBar);
    this.sizer.add(propagateGradientSection);
    this.sizer.add(starMaskBar);
    this.sizer.add(starMaskSection);
    this.sizer.add(this.mosaicBar);
    this.sizer.add(mosaicSection);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);
    
    starDetectionSection.hide();
    photometrySearchSection.hide();
    joinAreaSection.hide();
    propagateGradientSection.hide();
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
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
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
            (new MessageBox("ERROR: Cannot linear fit a B&W image with a colour image", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.hasJoinAreaPreview){
            if (data.joinAreaPreview_X1 > data.targetView.image.width || 
                    data.joinAreaPreview_Y1 > data.referenceView.image.height){
                (new MessageBox("ERROR: Join Region Preview extends beyond the edge of the image\n" +
                "Have you selected the wrong preview?", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
                continue;
            }
        }
        if (data.targetView.fullId === data.referenceView.fullId ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Target and  Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.propagateFlag && data.propagateSmoothness < data.gradientSmoothness){
            (new MessageBox("Propagated Smoothness must be less than or equal to Tapered Smoothness", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.createMosaicFlag && data.orientation === INSERT() && (data.mosaicOverlayRefFlag || data.mosaicRandomFlag)){
            (new MessageBox("Valid mosaic overlay methods for the Insert mode are\nTarget and Average", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        PhotometricMosaic(data);
        data.saveParameters();  // Want to save script parameters to the newly created mosaic window. This does not work...
        console.hide();
    }
    
    return;
}

/**
 * Create a dialog that displays the supplied bitmap
 * @param {Bitmap} bitmap Bitmap to display (e.g. graph bitmap)
 * @param {String} title Window title
 * @param {String Function(x, y)} screenToWorld Translates bitmap (x,y) to graph (x,y)
 * @returns {GraphDialog}
 */
function GraphDialog(bitmap, title, screenToWorld)
{
    this.__base__ = Dialog;
    this.__base__();
    let self = this;
    
    /**
     * Converts bitmap (x,y) into graph coordinates.
     * @param {Number} x Bitmap x coordinate
     * @param {Number} y Bitmap y coordinate
     * @returns {String} Output string in format "( x, y )"
     */
    this.displayXY = function (x, y){
        self.windowTitle = title + "  " + screenToWorld(x, y);
    };
    
    // Draw bitmap into this component
    this.bitmapControl = new Control(this);
    this.bitmapControl.setScaledMinSize(bitmap.width, bitmap.height);
    this.bitmapControl.onPaint = function (){
        let g = new Graphics(this);
        g.drawBitmap(0, 0, bitmap);
        g.end();
    };
    this.bitmapControl.onMousePress = function ( x, y, button, buttonState, modifiers ){
        if (button === 2){
            // Right mouse button -> MessageBox -> Close dialog and save graph to PixInsight View
            let messageBox = new MessageBox( "Save Graph (create Image Window)?\n",
                    "Save and Close Graph", 
                    StdIcon_Question, StdButton_Yes, StdButton_No, StdButton_Cancel);
            let reply = messageBox.execute();
            if (reply === StdButton_Yes){
                self.done(StdButton_Yes);
            } else if (reply === StdButton_No){
                self.done(StdButton_No);
            }
        } else {
            // Any other button. Display graph coordinates in title bar
            self.displayXY(x, y);
        }
    };
    this.bitmapControl.onMouseMove = function ( x, y, buttonState, modifiers ){
        // When dragging mouse, display graph coordinates in title bar
        self.displayXY(x, y);
    };
    this.bitmapControl.toolTip = "(Esc: Close,  Left click: (x,y),  Right click: Save)";

    this.sizer = new HorizontalSizer(this);
    this.sizer.margin = 2;
    this.sizer.add(this.bitmapControl, 100);
    this.adjustToContents();
    this.dialog.setFixedSize();
    this.windowTitle = title + "  (Esc: Close,  Left click: (x,y),  Right click: Save)";
}
