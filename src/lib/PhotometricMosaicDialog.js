/* global ImageWindow, Parameters, View, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok, Dialog */
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
 * Default the Reference view to the open view named "Mosaic".
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view).
 * Avoid all graph / sample windows that start with "PM__"
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultReferenceView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let referenceView = null;
    // Oldest images at start of array, iconised images at end
    for (let i = allWindows.length - 1; i > -1; --i) {
        let win = allWindows[i];
        if (win.mainView.fullId.startsWith(WINDOW_ID_PREFIX()) || !win.visible ){
            continue;
        }
        if (win.mainView.fullId.toLowerCase().contains("mosaic")) {
            referenceView = win.mainView;
            break;
        }
    }
    if (null === referenceView) {
        for (let win of allWindows) {
            if (win.mainView.fullId.startsWith(WINDOW_ID_PREFIX())) {
                continue;
            }
            if (activeWindow.mainView.fullId !== win.mainView.fullId) {
                referenceView = win.mainView;
                break;
            }
        }
    }
    return referenceView;
}

/**
 * Default the target view to the current view provided it is not a graph/sample
 * window (starting with "PM__").
 * @param {ImageWindow} activeWindow
 * @param {View} referenceView
 * @returns {win.mainView}
 */
function getDefaultTargetView(activeWindow, referenceView){
    let targetView = null;
    if (!activeWindow.mainView.fullId.startsWith(WINDOW_ID_PREFIX())){
        targetView = activeWindow.mainView;
    } else {
        let allWindows = ImageWindow.openWindows;
        for (let win of allWindows) {
            if (win.mainView.fullId.startsWith(WINDOW_ID_PREFIX())) {
                continue;
            }
            if (referenceView !== win.mainView.fullId) {
                targetView = win.mainView;
                break;
            }
        }
    }
    return targetView;
}

/**
 * Initialise the preview ViewList selection.
 * If there are no previews, do not set the preview.
 * If the areaOfInterst is uninitialised (all coords are zero) and targetView
 * only has one preview, use this preview.
 * If the areaOfInterst is uninitialised (all coords are zero) and targetView
 * has more than one preview, do not set the preview. Force the user to decide.
 * If the areaOfInterst is initialised (at least one coord is not zero) and a
 * targetView preview exactly matches the areaOfInterest, use this preview.
 * If the areaOfInterst is initialised (at least one coord is not zero) but no
 * targetView preview matches the areaOfInterest, do not set the preview.
 * @param {ViewList} previewImage_ViewList
 * @param {PhotometricMosaicData} data
 * @param {View} targetView
 */
function setTargetPreview(previewImage_ViewList, data, targetView){
    let previews = targetView.window.previews;
    if (previews.length > 0) {
        if (data.areaOfInterest_X0 === 0 &&
                data.areaOfInterest_Y0 === 0 &&
                data.areaOfInterest_X1 === 0 &&
                data.areaOfInterest_Y1 === 0){
            // areaOfInterest is uninitialised
            if (previews.length === 1){
                // There is only one preview, so use this preview
                data.preview = previews[0];
                previewImage_ViewList.currentView = data.preview;
                
            }
        } else {
            // areaOfInterst is initialised
            let w = targetView.window;
            let previews = w.previews;
            for (let preview of previews){
                let r = w.previewRect( preview );
                if (r.x0 === data.areaOfInterest_X0 &&
                        r.x1 === data.areaOfInterest_X1 &&
                        r.y0 === data.areaOfInterest_Y0 &&
                        r.y1 === data.areaOfInterest_Y1){
                    // areaOfInterst is initialised and preview matches it.
                    data.preview = preview;
                    previewImage_ViewList.currentView = data.preview;
                    break;
                }
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function PhotometricMosaicData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
        if (this.referenceView.isMainView) {
            Parameters.set("referenceView", this.referenceView.fullId);
        }
        Parameters.set("starDetection", this.logStarDetection);
        Parameters.set("orientation", this.orientation);
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("outlierRemoval", this.outlierRemoval);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("nLineSegments", this.nLineSegments);
        Parameters.set("taperFlag", this.taperFlag);
        Parameters.set("taperLength", this.taperLength);
        Parameters.set("createMosaicFlag", this.createMosaicFlag);
        Parameters.set("mosaicOverlayRefFlag", this.mosaicOverlayRefFlag);
        Parameters.set("mosaicOverlayTgtFlag", this.mosaicOverlayTgtFlag);
        Parameters.set("mosaicRandomFlag", this.mosaicRandomFlag);
        Parameters.set("mosaicAverageFlag", this.mosaicAverageFlag);
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("multiplyStarRadius", this.radiusMult);
        Parameters.set("addStarRadius", this.radiusAdd);
        
        Parameters.set("hasAreaOfInterest", this.hasAreaOfInterest);
        Parameters.set("areaOfInterest_X0", this.areaOfInterest_X0);
        Parameters.set("areaOfInterest_Y0", this.areaOfInterest_Y0);
        Parameters.set("areaOfInterest_X1", this.areaOfInterest_X1);
        Parameters.set("areaOfInterest_Y1", this.areaOfInterest_Y1);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("starDetection"))
            this.logStarDetection = Parameters.getReal("starDetection");
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("outlierRemoval"))
            this.outlierRemoval = Parameters.getInteger("outlierRemoval");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("nLineSegments"))
            this.nLineSegments = Parameters.getInteger("nLineSegments");
        if (Parameters.has("taperFlag"))
            this.taperFlag = Parameters.getBoolean("taperFlag");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
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
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("multiplyStarRadius"))
            this.radiusMult = Parameters.getReal("multiplyStarRadius");
        if (Parameters.has("addStarRadius"))
            this.radiusAdd = Parameters.getReal("addStarRadius");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId);
        }
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId);
        }

        if (Parameters.has("hasAreaOfInterest"))
            this.hasAreaOfInterest = Parameters.getBoolean("hasAreaOfInterest");
        if (Parameters.has("areaOfInterest_X0")){
            this.areaOfInterest_X0 = Parameters.getInteger("areaOfInterest_X0");
        }
        if (Parameters.has("areaOfInterest_Y0")){
            this.areaOfInterest_Y0 = Parameters.getInteger("areaOfInterest_Y0");
        }
        if (Parameters.has("areaOfInterest_X1")){
            this.areaOfInterest_X1 = Parameters.getInteger("areaOfInterest_X1");
        }
        if (Parameters.has("areaOfInterest_Y1")){
            this.areaOfInterest_Y1 = Parameters.getInteger("areaOfInterest_Y1");
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.logStarDetection = -1;
        this.orientation = AUTO();
        this.rejectHigh = 0.5;
        this.outlierRemoval = 0;
        this.sampleSize = 20;
        this.limitSampleStarsPercent = 100;
        this.nLineSegments = 25;
        this.taperFlag = true;
        this.taperLength = 1000;
        this.createMosaicFlag = true;
        this.mosaicOverlayRefFlag = false;
        this.mosaicOverlayTgtFlag = false;
        this.mosaicRandomFlag = true;
        this.mosaicAverageFlag = false;
        this.limitMaskStarsPercent = 20;
        this.radiusMult = 2.5;
        this.radiusAdd = -1;

        this.hasAreaOfInterest = false;
        this.areaOfInterest_X0 = 0;
        this.areaOfInterest_Y0 = 0;
        this.areaOfInterest_X1 = 0;
        this.areaOfInterest_Y1 = 0;
        
        this.starCache = new StarCache();
        this.testFlag = 0;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.orientationCombo.currentItem = AUTO();
        linearFitDialog.starDetectionControl.setValue(this.logStarDetection);
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.outlierRemoval_Control.setValue(this.outlierRemoval);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        linearFitDialog.lineSegments_Control.setValue(this.nLineSegments);
        linearFitDialog.taperFlag_Control.checked = this.taperFlag;
        linearFitDialog.taperLength_Control.setValue(this.taperLength);
        linearFitDialog.displayMosaicControl.checked = this.createMosaicFlag;
        linearFitDialog.mosaicOverlayRefControl.checked = this.mosaicOverlayRefFlag;
        linearFitDialog.mosaicOverlayTgtControl.checked = this.mosaicOverlayTgtFlag;
        linearFitDialog.LimitMaskStars_Control.setValue(this.limitMaskStarsPercent);
        linearFitDialog.StarRadiusMultiply_Control.setValue(this.radiusMult);
        linearFitDialog.StarRadiusAdd_Control.setValue(this.radiusAdd);
        
        linearFitDialog.areaOfInterestCheckBox.checked = this.hasAreaOfInterest;
        linearFitDialog.rectangleX0_Control.setValue(this.areaOfInterest_X0);
        linearFitDialog.rectangleY0_Control.setValue(this.areaOfInterest_Y0);
        linearFitDialog.rectangleX1_Control.setValue(this.areaOfInterest_X1);
        linearFitDialog.rectangleY1_Control.setValue(this.areaOfInterest_Y1);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultReferenceView(activeWindow);
    this.targetView = getDefaultTargetView(activeWindow, this.referenceView);
    // Initialise the script's data
    this.setParameters();
}

// The main dialog function
function PhotometricMosaicDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            " &mdash; Corrects the scale and gradient between two registered images.</b><br />" +
            "(1) Each join must be approximately vertical or horizontal.<br />" +
            "(2) Join frames into either columns or rows.<br />" +
            "(3) Join these strips to create the final mosaic.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("Reference View:");
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference View:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = labelWidth1;
    referenceImage_Label.toolTip = "<p>The reference image. This image will not be modified.</p>";

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getMainViews();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = 
            "<p>The reference image. This image will not be modified.</p>";
    this.referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };

    let referenceImage_Sizer = new HorizontalSizer;
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(this.referenceImage_ViewList, 100);

    //-------------------------------------------------------
    // Create the target image field
    //-------------------------------------------------------
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target View:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;
    targetImage_Label.toolTip = "<p>This image is first multiplied by " +
            "the photometrically determined scale factor, then the gradient " +
            "is calculated and subtracted.</p>";

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>This image is first multiplied by " +
            "the photometrically determined scale factor, then the gradient " +
            "is calculated and subtracted.</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    let labelSize = this.font.width("Line Segments:") + 9;
    //----------------------------------------------------
    // Star detection group box
    //----------------------------------------------------
    this.starDetectionControl = new NumericControl(this);
    this.starDetectionControl.real = true;
    this.starDetectionControl.label.text = "Star Detection:";
    this.starDetectionControl.label.minWidth = labelSize;
    this.starDetectionControl.toolTip = "<p>Smaller values detect more stars.</p>";
    this.starDetectionControl.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetectionControl.setRange(-3, 1);
    this.starDetectionControl.slider.setRange(0, 400);
    this.starDetectionControl.setPrecision(1);
    this.starDetectionControl.slider.minWidth = 206;
    this.starDetectionControl.setValue(data.logStarDetection);
    
    let detectedStarsButton = new PushButton();
    detectedStarsButton.text = "Detected Stars";
    detectedStarsButton.toolTip = 
            "<p>Displays all the stars detected in the reference and target images. " +
            "The detected stars are cached until either the PhotometricMosaic dialog " +
            "is closed or a modification invalidates the cache.</p>";
    detectedStarsButton.onClick = function () {
        data.viewFlag = DETECTED_STARS_FLAG();
        this.dialog.ok();
    };
    
    let starDetectionSizer = new HorizontalSizer;
    starDetectionSizer.spacing = 4;
    starDetectionSizer.add(this.starDetectionControl);
    starDetectionSizer.addStretch();
    starDetectionSizer.add(detectedStarsButton);

    let starDetectionGroupBox = createGroupBox(this, "Star Detection");
    starDetectionGroupBox.sizer.add(starDetectionSizer);
    //----------------------------------------------------
    // photometry group box
    //----------------------------------------------------
    this.rejectHigh_Control = new NumericControl(this);
    this.rejectHigh_Control.real = true;
    this.rejectHigh_Control.label.text = "Linear Range:";
    this.rejectHigh_Control.label.minWidth = labelSize;
    this.rejectHigh_Control.toolTip = 
            "<p>This control restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value. " +
            "It is important that these stars are within the " +
            "camera's linear response range.</p>" + 
            "<p>After examining the Photometry Graph, if the brightest plotted stars " +
            "looks suspect, they can be removed by reducing the 'Linear Range'. " +
            "This can sometimes be easer than using 'Outlier Removal'</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.rejectHigh = value;
    };
    this.rejectHigh_Control.setRange(0.1, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 500);
    this.rejectHigh_Control.setPrecision(2);
    this.rejectHigh_Control.slider.minWidth = 206;
    this.rejectHigh_Control.setValue(data.rejectHigh);

    let photometrySizer = new HorizontalSizer;
    photometrySizer.spacing = 4;
    photometrySizer.add(this.rejectHigh_Control);
    photometrySizer.addStretch();
    
    this.outlierRemoval_Control = new NumericControl(this);
    this.outlierRemoval_Control.real = false;
    this.outlierRemoval_Control.label.text = "Outlier Removal:";
    this.outlierRemoval_Control.label.minWidth = labelSize;
    this.outlierRemoval_Control.toolTip = 
            "<p>The photometric measurement of some stars can be suspect. " +
            "For example, the area around the star that's used to calculate " +
            "the background level may contain too many bright pixels. " +
            "This control determines the number of outlier stars to remove. " +
            "This can improve accuracy, but don't over do it!</p>" +
            "<p>Use the 'Photometry Graph' button to see the " +
            "photometry data points and the best fit line.</p>";
    this.outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
    };
    this.outlierRemoval_Control.setRange(0, 50);
    this.outlierRemoval_Control.slider.setRange(0, 50);
    this.outlierRemoval_Control.slider.minWidth = 220;
    this.outlierRemoval_Control.setValue(data.outlierRemoval);
    
    let photometryStarsButton = new PushButton();
    photometryStarsButton.text = "Photometry Stars";
    photometryStarsButton.toolTip = 
            "<p>Use this button to display the stars that met the criteria for photometry. " +
            "These stars were within the specified 'Linear Range' and were found " +
            "in both target and reference images.</p>" +
            "<p>The color represents the color channel. " +
            "Hence a white square indicates the star was found in the red, green and blue channels.</p>";
    photometryStarsButton.onClick = function () {
        data.viewFlag = PHOTOMETRY_STARS_FLAG();
        this.dialog.ok();
    };
    
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
            "<p>Useful data is also saved to the FITS header.</p>";
    photometryGraphButton.onClick = function () {
        data.viewFlag = PHOTOMETRY_GRAPH_FLAG();
        this.dialog.ok();
    };
    
    let outlierSizer = new HorizontalSizer;
    outlierSizer.spacing = 4;
    outlierSizer.add(this.outlierRemoval_Control);
    outlierSizer.addStretch();
    outlierSizer.add(photometryGraphButton);
    outlierSizer.addSpacing(2);
    outlierSizer.add(photometryStarsButton);

    let photometryGroupBox = createGroupBox(this, "Photometric Scale");
    photometryGroupBox.sizer.add(photometrySizer);
    photometryGroupBox.sizer.add(outlierSizer);

    //-------------------------------------------------------
    // Gradient detection group box
    //-------------------------------------------------------
    let directionLabel = new Label(this);
    directionLabel.text = "Direction:";
    directionLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    directionLabel.minWidth = labelSize;

    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = 
            "<p>Orientation of the line of intersection. 'Auto' usually works well.</p>" +
            "<p>The 'Auto' mode looks at the calculated overlap region. " +
            "If this region is wider than it is tall, the line of intersection " +
            "is assumed to be horizontal. If not, it assumes a vertical join. " +
            "In ambiguous cases, setting the 'Area of Interest' will help.</p>" +
            "<p>This script is designed to apply the horizontal and vertical components " +
            "of the gradient separately so it works best for joins that are " +
            "approximately horizontal or vertical.</p>" +
            "<p>To avoid adding a 'corner' with both a horizontal and vertical join, " +
            "build up the mosaic as rows or columns. " +
            "Then join these strips to create the final mosaic.</p>";
            
    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.addItem("Auto");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
    };
    
    let displaySamplesButton = new PushButton();
    displaySamplesButton.text = "Sample Grid";
    displaySamplesButton.toolTip = 
            "<p>The 'Sample Grid' button displays the grid of samples that will " +
            "be used to calculate the background offset and gradient.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star included in the 'Limit Stars %' list. " +
            "The surviving samples are drawn as squares. The stars used to " +
            "reject samples are indicated by circles.</p>";
    displaySamplesButton.onClick = function () {
        data.viewFlag = DISPLAY_SAMPLES_FLAG();
        this.dialog.ok();
    };
    
    let gradientGraphButton = new PushButton();
    gradientGraphButton.text = "Gradient Graph";
    gradientGraphButton.toolTip = 
            "<p>The vertical axis represents the difference between the two images. " +
            "The horizontal axis represents the join's X-Coordinate (horizontal join) " +
            "or Y-Coordinate (vertical join).</p>" +
            "<p>Each plotted dot represents the difference between a target and " +
            "reference sample. The lines drawn represent the best fit line segments. " +
            "It is these line segments that are used to determine the relative " +
            "gradient between the two images.</p>" +
            "<p>The graphs produced for color images use red, green and blue dots " +
            "and lines for each channel. The colors add together. " +
            "For example: red, green and blue add up to white.</p>" +
            "<p>If a small proportion of the plotted points have excessive scatter, " +
            "this may indicate that some samples contain bright stars that " +
            "occupy more than half the sample area. Either increase the 'Sample Size' " +
            "to increase the area of each sample, or increase the 'Limit Stars %' " +
            "so that samples that contain bright stars are rejected.</p>" +
            "<p>To increase the number sample points, decrease 'Limit Stars %' " +
            "or reduce the 'Sample Size'.</p>";
    gradientGraphButton.onClick = function () {
        data.viewFlag = GRADIENT_GRAPH_FLAG();
        this.dialog.ok();
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(directionLabel);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addStretch();
    orientationSizer.add(gradientGraphButton);
    orientationSizer.addSpacing(2);
    orientationSizer.add(displaySamplesButton);

    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = true;
    this.sampleSize_Control.label.text = "Sample Size:";
    this.sampleSize_Control.label.minWidth = labelSize;
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
            "<p>Larger samples are more tolerant to unrejected stars, " +
            "but smaller samples might be necessary for small overlaps. " +
            "Ideally set to more than 1.5x the size of the largest star in the " +
            "overlapping region. Rejecting more samples that contain stars by " +
            "increasing 'Limit Stars %' reduces this requirement.</p>" +
            "<p>Use the 'Sample Grid' button to visualize the grid of samples.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(3, 50);
    this.sampleSize_Control.slider.setRange(3, 50);
    this.sampleSize_Control.setPrecision(0);
    this.sampleSize_Control.slider.minWidth = 200;
    this.sampleSize_Control.setValue(data.sampleSize);

    this.limitSampleStarsPercent_Control = new NumericControl(this);
    this.limitSampleStarsPercent_Control.real = true;
    this.limitSampleStarsPercent_Control.label.text = "Limit Stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = labelSize;
    this.limitSampleStarsPercent_Control.toolTip = 
            "<p>Specifies the percentage of detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by an error in the calculated scale. " +
            "Although the photometric strategy has a high level of accuracy, " +
            "no measurement is perfect.</li>" +
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

    this.lineSegments_Control = new NumericControl(this);
    this.lineSegments_Control.real = false;
    this.lineSegments_Control.label.text = "Line Segments:";
    this.lineSegments_Control.label.minWidth = labelSize;
    this.lineSegments_Control.toolTip = 
            "<p>Determines the number of lines used to fit the gradient data.</p>" +
            "<p>It is worth experimenting with the number of lines to get a good fit to the data. " +
            "Too many lines may fit noise or artifacts.</p>";
    this.lineSegments_Control.onValueUpdated = function (value) {
        data.nLineSegments = value;
    };
    this.lineSegments_Control.setRange(1, 49);
    this.lineSegments_Control.slider.setRange(1, 25);
    this.lineSegments_Control.slider.minWidth = 200;
    this.lineSegments_Control.setValue(data.nLineSegments);
    
    let taperTooltip = "<p>The gradient correction is applied to the target image " +
            "along a line perpendicular to the horizontal or vertical join.</p>" +
            "<p>When taper is selected, the correction applied is gradually " +
            "tapered down over the taper length to the average offset difference. " +
            "This prevents the local gradient corrections requied at the join from " +
            "propogating to the opposite edge of the target frame.</p>" +
            
            "<p>The correction applied to the target image is applied as a single " +
            "calculation, but in principle it can be thought of as three steps:</p>" +
            "<ul><li>The scale factor is applied to the whole of the target image. " +
            "'Taper Length' has no affect. </li>" +
            "<li>The average offset between the two images is applied to the whole " +
            "of the target image. 'Taper Length' has no affect. </li>" +
            "<li>The horizontal (or vertical) component of the gradient is calculated " +
            "for the horizontal (or vertical) join. In the overlapping region, the " +
            "full gradient is applied to the target image. Beyond the overlapping " +
            "region's bounding box, if 'Taper Length' is selected, the applied " +
            "gradient correction will gradually reduce to zero. However, if " +
            "'Taper Length' is not selected, the gradient correction will be applied " +
            "fully across the whole of the target frame.</li></ul>" +
            
            "<p>You should consider applying a taper to the gradient if you are " +
            "correcting a complex gradient that required many line segments to match " +
            "the points plotted in the 'Gradient Graph'. It is unlikely that a " + 
            "complex gradient curve would match the light pollution gradient on " +
            "the other side of the target frame.</p>" +
            
            "<p>On the other hand, a simple gradient, for example one that could " +
            "be approximated by 1 or 3 line segments, might not need a taper. " +
            "If the reference frame has less gradient than the target, allowing " +
            "the gradient to propagate across the whole of the target frame " +
            "(i.e. no taper) will most likely be beneficial. It will tend to " +
            "partially correct the gradient across the whole of the target frame.</p>";
    this.taperFlag_Control = new CheckBox(this);
    this.taperFlag_Control.text = "Taper";
    this.taperFlag_Control.toolTip = taperTooltip;
    this.taperFlag_Control.checked = data.taperFlag;
    this.taperFlag_Control.onClick = function (checked) {
        data.taperFlag = checked;
    };
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Length:";
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(50, 10000);
    this.taperLength_Control.slider.setRange(1, 200);
    this.taperLength_Control.slider.minWidth = 200;
    this.taperLength_Control.setValue(data.taperLength);
    
    let taperSizer = new HorizontalSizer;
    taperSizer.spacing = 4;
    taperSizer.add(this.taperFlag_Control);
    taperSizer.add(this.taperLength_Control);

    let gradientGroupBox = createGroupBox(this, "Gradient Offset");
    gradientGroupBox.sizer.add(this.sampleSize_Control);
    gradientGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    gradientGroupBox.sizer.add(this.lineSegments_Control);
    gradientGroupBox.sizer.add(taperSizer);
    gradientGroupBox.sizer.add(orientationSizer);

    //-------------------------------------------------------
    // Mosaic Group Box
    //-------------------------------------------------------
    this.displayMosaicControl = new CheckBox(this);
    this.displayMosaicControl.text = "Create Mosaic";
    this.displayMosaicControl.toolTip = 
            "<p>Combines the reference and target frames together and " +
            "displays the result in the '" + MOSAIC_NAME() + "' window</p>" +
            "<p>If this option is not selected, the corrections will still be " +
            "applied to the target image, but the mosaic is not created.</p>" +
            "<p>After the first mosaic join, it is usually convenient to set " +
            "the reference view to '" + MOSAIC_NAME() + "'</p>";
    this.displayMosaicControl.checked = data.createMosaicFlag;
    this.displayMosaicControl.onClick = function (checked) {
        data.createMosaicFlag = checked;
    };

    let overlay_Label = new Label(this);
    overlay_Label.text = "Overlay:";
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
    this.mosaicRandomControl.toolTip = "<p>Over the overlapping region, pixels " +
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
    this.mosaicAverageControl.toolTip = "<p>Over the overlapping region, " +
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

    let mosaic_Sizer = new HorizontalSizer;
    mosaic_Sizer.spacing = 10;
    mosaic_Sizer.add(this.displayMosaicControl);
    mosaic_Sizer.addSpacing(50);
    mosaic_Sizer.add(overlay_Label);
    mosaic_Sizer.add(this.mosaicOverlayRefControl);
    mosaic_Sizer.add(this.mosaicOverlayTgtControl);
    mosaic_Sizer.add(this.mosaicRandomControl);
    mosaic_Sizer.add(this.mosaicAverageControl);
    mosaic_Sizer.addStretch();

    let mosaicGroupBox = createGroupBox(this, "Mosaic");
    mosaicGroupBox.sizer.add(mosaic_Sizer);
    
    //-------------------------------------------------------
    // Mask Generation Group Box
    //-------------------------------------------------------
    let createMaskButton = new PushButton();
    createMaskButton.text = "Create Mask";
    createMaskButton.toolTip = 
            "<p>Creates a star mask that reveals bright stars.</p>" +
            "<p>A mosaic join using the 'Random' mode is highly affective, but " +
            "often produces a speckled pattern around bright stars. This " +
            "mask option is provided to help fix this.</p>";
    createMaskButton.onClick = function () {
        data.viewFlag = MOSAIC_MASK_FLAG();
        this.dialog.ok();
    };
    
    let maskStarsButton = new PushButton();
    maskStarsButton.text = "Stars";
    maskStarsButton.toolTip = 
            "<p>Displays the stars used to create the mosaic star mask.</p>";
    maskStarsButton.onClick = function () {
        data.viewFlag = MOSAIC_MASK_STARS_FLAG();
        this.dialog.ok();
    };
    
    let mask_Sizer = new HorizontalSizer;
    mask_Sizer.spacing = 4;
    mask_Sizer.addStretch();
    mask_Sizer.add(createMaskButton);
    mask_Sizer.addSpacing(2);
    mask_Sizer.add(maskStarsButton);
    
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

    let starMaskGroupBox = createGroupBox(this, "Mosaic Star Mask");
    starMaskGroupBox.sizer.add(this.LimitMaskStars_Control);
    starMaskGroupBox.sizer.add(radiusHorizontalSizer);
    starMaskGroupBox.sizer.add(mask_Sizer);

    //-------------------------------------------------------
    // Area of interest
    //-------------------------------------------------------
    let labelWidth2 = this.font.width("Height:_");

    this.rectangleX0_Control = createNumericEdit("Left:", "Top left of rectangle X-Coordinate.", data.areaOfInterest_X0, labelWidth2, 50);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.areaOfInterest_X0 = value;
    };
    this.rectangleY0_Control = createNumericEdit("Top:", "Top left of rectangle Y-Coordinate.", data.areaOfInterest_Y0, labelWidth2, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y0 = value;
    };
    this.rectangleX1_Control = createNumericEdit("Right:", "Bottom right of rectangle X-Coordinate.", data.areaOfInterest_X1, labelWidth2, 50);
    this.rectangleX1_Control.onValueUpdated = function (value){
        data.areaOfInterest_X1 = value;
    };
    this.rectangleY1_Control = createNumericEdit("Bottom:", "Bottom right of rectangle Y-Coordinate.", data.areaOfInterest_Y1, labelWidth2, 50);
    this.rectangleY1_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y1 = value;
    };

    this.areaOfInterestCheckBox = new CheckBox(this);
    this.areaOfInterestCheckBox.text = "Area of Interest";
    this.areaOfInterestCheckBox.toolTip = 
            "<p>Limit the search for overlapping pixels to this bounding box.</p>" +
            "<p>If all overlapping pixels are within this area, selecting this " +
            "option reduces calculation time but does not effect the calculated overlap pixels.</p>" +
            "<p>If this area intersects the overlapping pixels, the calculated overlap pixels " +
            "are limited to those within the area. This is useful for a corner tile so that " +
            "the horizontal and vertical joins can be calculated separately.</p>" +
            "<p>If the mosaic is built by first creating the rows (or columns) and then joining " +
            "the resulting strips, it is not necessary to set the 'Area Of Interest'.</p>" +
            "<p>The first time the overlap is calculated, the 'Area Of Interest' will be updated " +
            "to the bounding box of the overlapping pixels that will be used to calculate the " +
            "target image scale and gradient.</p>";
    this.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
    this.areaOfInterestCheckBox.onClick = function (checked) {
        data.hasAreaOfInterest = checked;
    };

    let coordHorizontalSizer = new HorizontalSizer;
    coordHorizontalSizer.spacing = 10;
    coordHorizontalSizer.add(this.areaOfInterestCheckBox);
    coordHorizontalSizer.addSpacing(20);
    coordHorizontalSizer.add(this.rectangleX0_Control);
    coordHorizontalSizer.add(this.rectangleY0_Control);
    coordHorizontalSizer.add(this.rectangleX1_Control);
    coordHorizontalSizer.add(this.rectangleY1_Control);
    coordHorizontalSizer.addStretch();

    let previewUpdateActions = function(dialog){
        let view = data.preview;
        if (view !== null && view.isPreview) {
            data.hasAreaOfInterest = true;
            dialog.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
            ///let imageWindow = view.window;
            let rect = view.window.previewRect(view);
            data.areaOfInterest_X0 = rect.x0;
            data.areaOfInterest_Y0 = rect.y0;
            data.areaOfInterest_X1 = rect.x1;
            data.areaOfInterest_Y1 = rect.y1;

            dialog.rectangleX0_Control.setValue(data.areaOfInterest_X0);
            dialog.rectangleY0_Control.setValue(data.areaOfInterest_Y0);
            dialog.rectangleX1_Control.setValue(data.areaOfInterest_X1);
            dialog.rectangleY1_Control.setValue(data.areaOfInterest_Y1);
        } else {
            data.hasAreaOfInterest = false;
            dialog.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
        }
    };

    // Area of interest Target->preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = "Get area from preview:";
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Get the 'Area of Interest' from a preview image.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        data.preview = view;
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

    let previewImage_Sizer = new HorizontalSizer;
    previewImage_Sizer.spacing = 4;
    previewImage_Sizer.add(previewImage_Label);
    previewImage_Sizer.add(this.previewImage_ViewList, 100);
    previewImage_Sizer.addSpacing(10);
    previewImage_Sizer.add(previewUpdateButton);

    let areaOfInterest_GroupBox = createGroupBox(this, "Area of Interest");
    areaOfInterest_GroupBox.sizer.add(coordHorizontalSizer, 10);
    areaOfInterest_GroupBox.sizer.add(previewImage_Sizer);

    const helpWindowTitle = TITLE() + " Help";
    const HELP_MSG =
            "<p>To install this script, use 'SCRIPT \> Feature Scripts...' and then in the " +
            "'Feature Scripts' dialog box, press the 'Add' button and select the folder where you have saved this script.</p>" +
            "<p>To install the help files, copy the 'PhotometricMosaic' folder from the 'Help' folder to " +
            "'[PixInsight]/doc/scripts/PhotometricMosaic</p>" +
            "<p>For example, on Windows, the correct installation would be:</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/PhotometricMosaic.html</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, HELP_MSG, "PhotometricMosaic");

    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleLabel);
    this.sizer.add(referenceImage_Sizer);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(areaOfInterest_GroupBox);
    this.sizer.add(starDetectionGroupBox);
    this.sizer.add(photometryGroupBox);
    this.sizer.add(gradientGroupBox);
    this.sizer.add(starMaskGroupBox);
    this.sizer.add(mosaicGroupBox);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);

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
    setTargetPreview(linearFitDialog.previewImage_ViewList, data, data.targetView);
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
        if (data.targetView.fullId === data.referenceView.fullId ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Target and  Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.window.maskEnabled && !data.targetView.window.mask.isNull) {
            (new MessageBox("ERROR: Target view mask detected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        PhotometricMosaic(data);
        
        if (data.hasAreaOfInterest){
            linearFitDialog.areaOfInterestCheckBox.checked = true;
            linearFitDialog.rectangleX0_Control.setValue(data.areaOfInterest_X0);
            linearFitDialog.rectangleY0_Control.setValue(data.areaOfInterest_Y0);
            linearFitDialog.rectangleX1_Control.setValue(data.areaOfInterest_X1);
            linearFitDialog.rectangleY1_Control.setValue(data.areaOfInterest_Y1);
            linearFitDialog.previewImage_ViewList.currentView = data.preview;
        }
        console.hide();

        // Quit after successful execution.
        //break;
    }

    return;
}
