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
"use strict";
#feature-id Utilities > gradientLinearFit

#feature-info Linear fits target and reference images over the overlaping area.<br/>\
Copyright & copy; 2019 John Murphy.GNU General Public License.<br/>

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>
#include "DialogLib.js"
#include "LinearFitLib.js"

#define VERSION  "1.0"
#define TITLE "Gradient Linear Fit"
#define MOSAIC_NAME "Mosaic"
#define HORIZONTAL 0
#define VERTICAL 1
#define AUTO 2

function displayConsoleInfo(linearFit, nSamples, channel, rejectHigh, sampleSize) {
    console.writeln("Channel = ", channel);
    console.writeln("  Samples: ", nSamples, ", Size: ", sampleSize, ", Reject high: ", rejectHigh);
    console.writeln("  Sample area: x = ", linearFit.sampleArea.x, ", y = ", linearFit.sampleArea.y,
        ", width = ", linearFit.sampleArea.width, ", height = ", linearFit.sampleArea.height);
    console.writeln("  Linear Fit:  m = ", linearFit.m.toPrecision(5), ", b = ", linearFit.b.toPrecision(5));
}

/**
 * Controller. Processing starts here!
 * @param {MosaicLinearFitData} data Values from user interface
 */
function gradientLinearFit(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let referenceView = data.referenceView;
    let linearFit = []; // linear fit details (m and b) for all channels
    let samplePairArray = []; // SamplePair[channel][SamplePairArray]
    let nChannels;      // L = 0; R=0, G=1, B=2
    if (targetView.image.isColor) {
        nChannels = 3;
    } else {
        nChannels = 1;
    }
    
    console.writeln("Reference: ", referenceView.fullId, ", Target: ", targetView.fullId);
    let isHorizontal;
    let detectOrientation = false;
    if (data.orientation === HORIZONTAL){
        console.writeln("<b>Mode: Horizontal Gradient</b>");
        isHorizontal = true;
    } else if (data.orientation === VERTICAL){
        console.writeln("<b>Mode: Vertical Gradient</b>");
        isHorizontal = false;
    } else {
        detectOrientation = true;
    }

    // For each channel (L or RGB)
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let channel = 0; channel < nChannels; channel++) {
        samplePairArray[channel] = createSamplePairs(targetView.image, referenceView.image,
                channel, data.sampleSize, data.rejectHigh, 0);
        if (samplePairArray[channel].length < 2) {
            new MessageBox("Error: Too few samples to determine a linear fit.", TITLE, StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        let sampleArea = getSampleArea(samplePairArray[channel]);
        if (detectOrientation){
            detectOrientation = false;
            isHorizontal = sampleArea.width > sampleArea.height;
            if (isHorizontal){
                console.writeln("<b>Mode auto selected: Horizontal Gradient</b>");
            } else {
                console.writeln("<b>Mode auto selected: Vertical Gradient</b>");
            }
        }
        if (isHorizontal) {
            linearFit[channel] = calculateLinearFit(samplePairArray[channel], getHorizontalGradientX, getHorizontalGradientY);
        } else {
            linearFit[channel] = calculateLinearFit(samplePairArray[channel], getVerticalGradientX, getVerticalGradientY);
        }
        linearFit[channel].sampleArea = sampleArea;
        displayConsoleInfo(linearFit[channel], samplePairArray[channel].length,
                channel, data.rejectHigh, data.sampleSize);
    }

    if (data.displayGradientFlag){
        let title = "Gradient_" + targetView.fullId;
        displayGradient(targetView, linearFit, isHorizontal, title);
    }
    
    if (data.displayGradientFlag) { // displayGraphFlag
        console.writeln("\nCreating linear fit graph");
        let graph;
        let graphWidth;
        if (isHorizontal){
            let title = "HorizontalFit_" + targetView.fullId;
            graph = new Graph(title, getHorizontalGradientX, getHorizontalGradientY);
            graphWidth = targetView.image.width;
        } else {
            let title = "VerticalFit_" + targetView.fullId;
            graph = new Graph(title, getVerticalGradientX, getVerticalGradientY);
            graphWidth = targetView.image.height;
        }
        let imageWindow = graph.createGradientFitWindow(samplePairArray, nChannels, graphWidth);
        graph.displayGraphWindow(imageWindow, nChannels, linearFit, samplePairArray);
    }

    if (isHorizontal) {
        console.writeln("\nApplying horizontal gradient");
    } else {
        console.writeln("\nApplying vertical gradient");
    }
    applyGradient(targetView, linearFit, isHorizontal);

    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * Display the detected gradient to the user
 * @param {View} targetView Create a new image with the same dimensions as the target image
 * @param {LinearFit[]} line The detected gradient
 * @param {Boolean} isHorizontal True if displaying a horizontal gradient
 * @param {String} title Title for the displayed gradient window
 * @returns {undefined}
 */
function displayGradient(targetView, line, isHorizontal, title) {
    // Create ImageWindow and View
    let nChannels = line.length;
    let targetImage = targetView.image;
    let window = new ImageWindow(targetImage.width, targetImage.height,
            nChannels, targetImage.bitsPerSample, targetImage.isReal, targetImage.isColor, title);

    let view = window.mainView;
    let targetId = targetView.fullId;
    createGradient(view, line, isHorizontal, targetId);
    
    // Set bg level to ensure no pixels are negative.
    let image = view.image;
    let w = image.width;
    let h = image.height;
    let min = Number.MAX_VALUE;
    for (let x = 0; x < w; x++){
        for (let y = 0; y < h; y++){
            for (let c = 0; c < nChannels; c++){
                let value = image.sample(x, y, c);
                if (0 !== value){
                    min = Math.min(min, value);
                }
            }
        }
    }
    if (min !== Number.MAX_VALUE){
        console.writeln("Subtracting ", min.toPrecision(5), " from ", title);
        let P = new PixelMath;
        P.expression = "iif($T == 0, 0, $T - " + min + ")";
        P.symbols = "";
        P.useSingleExpression = true;
        P.singleThreaded = false;
        P.use64BitWorkingImage = true;
        P.rescale = false;
        P.truncate = true;
        P.createNewImage = false;
        P.executeOn(view, true);
    }
    
    window.show();
}

/**
 * Create the detected gradient so that it can be displayed to the user
 * @param {View} view A new empty image.
 * @param {LinearFit[]} line
 * @param {Boolean} isHorizontal
 * @param {String} targetId Target image name
 * @returns {undefined}
 */
function createGradient(view, line, isHorizontal, targetId){
    // Make sure the pixel math does not create a negative image
    let minValue = 0;
    for (let linearFit of line){ // for each channel
        let dist1;
        let dist2;
        if (isHorizontal){
            dist1 = linearFit.sampleArea.x;
            dist2 = dist1 + linearFit.sampleArea.width;
        } else {
            dist1 = linearFit.sampleArea.y;
            dist2 = dist1 + linearFit.sampleArea.height;
        }
        minValue = Math.min(minValue, linearFit.m * dist1 + linearFit.b); // value at start
        minValue = Math.min(minValue, linearFit.m * dist2 + linearFit.b); // value at end
    }
    // minValue is zero or below zero. Multiply by -1 so we can add it
    minValue *= -1;
 
    let expression;
    if (isHorizontal){
        expression = "iif(" + targetId + " == 0, 0, x() * ";
    } else {
        expression = "iif(" + targetId + " == 0, 0, y() * ";
    }
    let P = new PixelMath;
    P.expression = expression + line[0].m + " + " + line[0].b + " + " + minValue + ")";
    if (3 === line.length) { // RGB
        P.expression1 = expression + line[1].m + " + " + line[1].b + " + " + minValue + ")";
        P.expression2 = expression + line[2].m + " + " + line[2].b + " + " + minValue + ")";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.symbols = "";
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = true;
    P.truncateLower = 0;
    P.truncateUpper = 1;
    P.createNewImage = false;
    P.executeOn(view, true);
}

/**
 * Subtract the detected gradient from the target view
 * @param {View} targetView Apply the gradient correction to this view
 * @param {LinearFit[]} line Gradient linear fit line y = mx + b, for each channel
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @returns {undefined}
 */
function applyGradient(targetView, line, isHorizontal) {
    let expression;
    if (isHorizontal){
        expression = "iif( $T == 0, 0, $T - (x() * ";
    } else {
        expression = "iif( $T == 0, 0, $T - (y() * ";
    }
    let P = new PixelMath;
    P.expression = expression + line[0].m + " + " + line[0].b + "))";
    if (3 === line.length) { // RGB
        P.expression1 = expression + line[1].m + " + " + line[1].b + "))";
        P.expression2 = expression + line[2].m + " + " + line[2].b + "))";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.symbols = "";
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = true;
    P.truncateLower = 0;
    P.truncateUpper = 1;
    P.createNewImage = false;
    P.executeOn(targetView, true);
}

/**
 * Default the Reference view to any view that is NOT the current view
 * (the Target view will be set to the current view)
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultReferenceView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let referenceView = null;
    for (let win of allWindows) {
        if (activeWindow.currentView.fullId !== win.currentView.fullId) {
            referenceView = win.currentView;
            break;
        }
    }
    return referenceView;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function MosaicLinearFitData() {
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
        Parameters.set("orientation", this.orientation);
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("displayGradientFlag", this.displayGradientFlag);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("displayGradientFlag"))
            this.displayGradientFlag = Parameters.getBoolean("displayGradientFlag");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId)
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.orientation = AUTO;
        this.rejectHigh = 0.5;
        this.sampleSize = 25;
        this.displayGradientFlag = true;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.orientationCombo.currentItem = AUTO;
        linearFitDialog.displayGradientControl.checked = this.displayGradientFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultReferenceView(activeWindow);
    if (!activeWindow.isNull) {
        this.targetView = activeWindow.currentView;
    }
    // Initialise the script's data
    this.setParameters();
}

// The main dialog function
function gradientLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    //-------------------------------------------------------
    // Set some basic widths from dialog text
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("Gradient Direction:_");

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION + "</b> &mdash; Linear fits target and reference images over the overlaping area.");
    
    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference View:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = labelWidth1;

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getAll();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = "<p>Select an image to generate a PSF for</p>";
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

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getAll();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select an image to generate a PSF for</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);


    //-------------------------------------------------------
    // Linear Fit Method Field
    //-------------------------------------------------------
    let algorithm_Label = new Label(this);
    algorithm_Label.text = "Gradient Direction:";
    algorithm_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    algorithm_Label.minWidth = labelWidth1;

    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = "<p>Set to the orientation of the line of intersection between the reference and target frames</p>";
    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.addItem("Auto");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
    };

    //-------------------------------------------------------
    // Display Graph, Display Test Mosaic
    //-------------------------------------------------------
    this.displayGradientControl = new CheckBox(this);
    this.displayGradientControl.text = "Display Gradient";
    this.displayGradientControl.toolTip = "Display the background model";
    this.displayGradientControl.checked = data.displayGradientFlag;
    this.displayGradientControl.onClick = function (checked) {
        data.displayGradientFlag = checked;
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(algorithm_Label);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addSpacing(50);
    orientationSizer.add(this.displayGradientControl);
    orientationSizer.addStretch();

    //-------------------------------------------------------
    // Rejection High
    //-------------------------------------------------------
    this.rejectHigh_Control = new NumericControl(this);
    this.rejectHigh_Control.real = true;
    this.rejectHigh_Control.label.text = "CCD Linear Range:";
    this.rejectHigh_Control.label.minWidth = labelWidth1;
    this.rejectHigh_Control.toolTip = "<p>Only use pixels within CCD's linear range. 0.5 works well.</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.rejectHigh = value;
    };
    this.rejectHigh_Control.setRange(0.001, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 5000);
    this.rejectHigh_Control.setPrecision(4);
    this.rejectHigh_Control.slider.minWidth = 500;
    this.rejectHigh_Control.setValue(data.rejectHigh);

    //-------------------------------------------------------
    // Sample Size
    //-------------------------------------------------------
    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = true;
    this.sampleSize_Control.label.text = "Sample Size:";
    this.sampleSize_Control.label.minWidth = labelWidth1;
    this.sampleSize_Control.toolTip = "<p>Sample binning size. Set between 1 and 3 times bright star diameter. Example: if star diameter = 10 then 30 would work well.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(1, 50);
    this.sampleSize_Control.slider.setRange(1, 50);
    this.sampleSize_Control.setPrecision(0);
    this.sampleSize_Control.slider.minWidth = 500;
    this.sampleSize_Control.setValue(data.sampleSize);

    const helpWindowTitle = TITLE + "." + VERSION;
    const HELP_MSG =
            "<p>Apply a gradient to the target image so that it matches the reference image. The default parameters should work well. " +
            "Adjust the 'Sample Size' if your images are over or under sampled.</p>" +
            "<p>The 'CCD Linear Range' rejects all sample squares that contain a sample above this level. " +
            "This ensures that only the linear part of the CCD's range is used.</p>" +
            "The 'Reject Brightest' rejects the N brightest samples. These samples are likely to contain " +
            "bright stars. Increase this if the samples diverge from the fitted line at the top left of the graph.</p>" +
            "<p>The images are divided into 'Sample Size' squares; a sample is the average of a square. " +
            "The 'Sample Size' should be bigger than the diameter of bright stars. " +
            "If set too small, differing FWHM between the two images will affect the linear fit.</p>";

    let newInstanceIcon = this.scaledResource(":/process-interface/new-instance.png");
    let buttons_Sizer = createWindowControlButtons(this.dialog, data, newInstanceIcon, helpWindowTitle, HELP_MSG);
    
    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(titleLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(referenceImage_Sizer);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(orientationSizer);
    this.sizer.add(this.rejectHigh_Control);
    this.sizer.add(this.sampleSize_Control);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
gradientLinearFitDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {
//    testLeastSquareFitAlgorithm();

    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new MosaicLinearFitData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new gradientLinearFitDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>Gradient Linear Fit ", VERSION, "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.referenceView.isNull) {
            (new MessageBox("WARNING: Reference view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.isColor !== data.referenceView.image.isColor) {
            (new MessageBox("ERROR: Cannot linear fit a B&W image with a colour image", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        gradientLinearFit(data);
        console.hide();

        // Quit after successful execution.
        // break;
    }

    return;
}

main();
