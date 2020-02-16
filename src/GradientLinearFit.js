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
#include "lib/DialogLib.js"
#include "lib/LinearFitLib.js"
#include "lib/LinearFitGraph.js"

#define VERSION  "1.0"
#define TITLE "Gradient Linear Fit"
#define MOSAIC_NAME "Mosaic"
#define HORIZONTAL 0
#define VERTICAL 1
#define AUTO 2

function displayConsoleInfo(linearFit, nSamples, channel, rejectHigh, sampleSize, rejectBrightestPercent) {
    console.writeln("Channel = ", channel);
    console.writeln("  Samples: ", nSamples, ", Size: ", sampleSize, ", Reject high: ", rejectHigh, ", Reject brightest: ", rejectBrightestPercent + "%");
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
    let colorSamplePairArray = []; // SamplePair[channel][SamplePairArray]
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

    let samplePreviewArea;
//    if (data.hasAreaOfInterest){
//        sampleArea = new Rectangle(data.areaOfInterest_X, data.areaOfInterest_Y, data.areaOfInterest_W, data.areaOfInterest_H);
//    } else {
        samplePreviewArea = new Rectangle(0, 0, targetView.image.width, targetView.image.height);
//    }

    // For each channel (L or RGB)
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let channel = 0; channel < nChannels; channel++) {
        colorSamplePairArray[channel] = createSamplePairs(targetView.image, referenceView.image,
                channel, data.sampleSize, data.rejectHigh, true, data.rejectBrightestPercent, samplePreviewArea);
        if (colorSamplePairArray[channel].length < 2) {
            new MessageBox("Error: Too few samples to determine a linear fit.", TITLE, StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        let sampleArea = getSampleArea(colorSamplePairArray[channel]);
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
            linearFit[channel] = calculateLinearFit(colorSamplePairArray[channel], getHorizontalGradientX, getHorizontalGradientY);
        } else {
            linearFit[channel] = calculateLinearFit(colorSamplePairArray[channel], getVerticalGradientX, getVerticalGradientY);
        }
        linearFit[channel].sampleArea = sampleArea;
        displayConsoleInfo(linearFit[channel], colorSamplePairArray[channel].length,
                channel, data.rejectHigh, data.sampleSize, data.rejectBrightestPercent);
    }

    let gradientArray = createGradientArray(targetView, linearFit, isHorizontal);

    if (data.displayGradientFlag){
        let title = "Gradient_" + targetView.fullId;
        displayGradient(targetView, title, isHorizontal, gradientArray);
    }
    
    if (data.displaySamplesFlag){
        let title = "Samples_" + targetView.fullId;
        let samplesWindow = drawSampleSquares(colorSamplePairArray, data.sampleSize, referenceView, title);
        samplesWindow.show();
    }

    if (data.displayGraphFlag) {
        console.writeln("\nCreating linear fit graph");
        let graph;
        let graphWidth;
        if (isHorizontal){
            let title = "Horizontal_Gradient_" + targetView.fullId;
            graph = new Graph(title, getHorizontalGradientX, getHorizontalGradientY);
            graphWidth = targetView.image.width;
        } else {
            let title = "Vertical_Gradient_" + targetView.fullId;
            graph = new Graph(title, getVerticalGradientX, getVerticalGradientY);
            graphWidth = targetView.image.height;
        }
        let imageWindow = graph.createGradientFitWindow(colorSamplePairArray, nChannels, graphWidth);
        graph.displayGradientGraphWindow(imageWindow, nChannels, gradientArray, colorSamplePairArray);
    }

    if (isHorizontal) {
        console.writeln("\nApplying horizontal gradient");
    } else {
        console.writeln("\nApplying vertical gradient");
    }
    applyGradient(targetView, isHorizontal, gradientArray);
    data.saveParameters();
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * Display the detected gradient to the user
 * @param {View} targetView Create a new image with the same dimensions as the target image
 * @param {String} title Title for the displayed gradient window
 * @param {Boolean} isHorizontal True if displaying a horizontal gradient
 * @param {GradientArray[]} gradientArray One GradientData structure for each channel.
 * @returns {undefined}
 */
function displayGradient(targetView, title, isHorizontal, gradientArray) {
    // Create ImageWindow and View
    let nChannels = gradientArray.length;
    let targetImage = targetView.image;
    let window = new ImageWindow(targetImage.width, targetImage.height,
            nChannels, targetImage.bitsPerSample, targetImage.isReal, targetImage.isColor, title);
    let view = window.mainView;

    let minValue = Number.MAX_VALUE;
    for (let channel = 0; channel < nChannels; channel++){
        minValue = Math.min(minValue, gradientArray[channel].minValue);
    }

    view.beginProcess();

    for (let channel = 0; channel < nChannels; channel++) {
        let difArray = gradientArray[channel].difArray;
        for (let y = 0; y < targetImage.height; y++) {
            for (let x = 0; x < targetImage.width; x++) {
                if (targetImage.sample(x, y, channel) !== 0) {
                    let value;
                    if (isHorizontal) {
                        value = difArray[x];
                    } else {
                        value = difArray[y];
                    }
                    if (minValue < 0) {
                        value -= minValue;
                    }
                    view.image.setSample(value, x, y, channel);
                }
            }
        }
    }



    view.endProcess();
    window.show();
}

/**
 * @param {View} targetView The created gradient is for this image
 * @param {LinearFit[]} line Gradient linear fit line y = mx + b
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @return {Number[][]} Gradient array of differences
 */
function createGradientArray(targetView, line, isHorizontal){
    let nPoints;
    let gradientArray = [];
    let nChannels = line.length;
    if (isHorizontal){
        nPoints = targetView.image.width;
    } else {
        nPoints = targetView.image.height;
    }
    let minValue = Number.MAX_VALUE;
    for (let color=0; color< nChannels; color++){
        let difArray = [];
        // p represents x (horizontal case) or y (vertical case)
        for (let p=0; p<nPoints; p++){
            let dif = p * line[color].m + line[color].b;
            difArray.push(dif);
            minValue = Math.min(dif, minValue);
        }
        gradientArray[color] = new GradientData(difArray, minValue);
    }
    return gradientArray;
}

/**
 * Subtract the detected gradient from the target view
 * @param {View} view Apply the gradient correction to this view
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @param {Number[].GradientData} gradientArray ColourChannel.GradientData diff data
 * @returns {undefined}
 */
function applyGradient(view, isHorizontal, gradientArray) {
    let nChannels = gradientArray.length;
    let targetImage = view.image;
    view.beginProcess();

    for (let channel = 0; channel < nChannels; channel++) {
        let difArray = gradientArray[channel].difArray;
        for (let y = 0; y < targetImage.height; y++) {
            for (let x = 0; x < targetImage.width; x++) {
                let sample = targetImage.sample(x, y, channel);
                if (sample !== 0) {
                    let value;
                    if (isHorizontal) {
                        value = sample - difArray[x];
                    } else {
                        value = sample - difArray[y];
                    }
                    view.image.setSample(value, x, y, channel);
                }
            }
        }
    }

    view.endProcess();
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
        Parameters.set("rejectBrightestPercent", this.rejectBrightestPercent);
        Parameters.set("displayGradientFlag", this.displayGradientFlag);
        Parameters.set("displayGraphFlag", this.displayGraphFlag);
        Parameters.set("displaySamplesFlag", this.displaySamplesFlag);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("rejectBrightestPercent"))
            this.rejectBrightestPercent = Parameters.getInteger("rejectBrightestPercent");
        if (Parameters.has("displayGradientFlag"))
            this.displayGradientFlag = Parameters.getBoolean("displayGradientFlag");
        if (Parameters.has("displayGraphFlag"))
            this.displayGraphFlag = Parameters.getBoolean("displayGraphFlag");
        if (Parameters.has("displaySamplesFlag"))
            this.displaySamplesFlag = Parameters.getBoolean("displaySamplesFlag");
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
        this.sampleSize = 15;
        this.rejectBrightestPercent = 10;
        this.displayGradientFlag = false;
        this.displayGraphFlag = true;
        this.displaySamplesFlag = true;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.orientationCombo.currentItem = AUTO;
        linearFitDialog.displayGradientControl.checked = this.displayGradientFlag;
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.displaySampleControl.checked = this.displaySamplesFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.rejectBrightestPercent_Control.setValue(this.rejectBrightestPercent);
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
    this.displayGraphControl = new CheckBox(this);
    this.displayGraphControl.text = "Display Graph";
    this.displayGraphControl.toolTip = "Display the sample points and their least squares fit line";
    this.displayGraphControl.checked = data.displayGraphFlag;
    this.displayGraphControl.onClick = function (checked) {
        data.displayGraphFlag = checked;
    };
    this.displaySampleControl = new CheckBox(this);
    this.displaySampleControl.text = "Display Samples";
    this.displaySampleControl.toolTip = "Display the sample squares";
    this.displaySampleControl.checked = data.displaySamplesFlag;
    this.displaySampleControl.onClick = function (checked) {
        data.displaySamplesFlag = checked;
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(algorithm_Label);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displayGradientControl);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displayGraphControl);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displaySampleControl);
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
    
    //-------------------------------------------------------
    // Reject brightest N samples
    //-------------------------------------------------------
    this.rejectBrightestPercent_Control = new NumericControl(this);
    this.rejectBrightestPercent_Control.real = true;
    this.rejectBrightestPercent_Control.label.text = "Reject Brightest%:";
    this.rejectBrightestPercent_Control.label.minWidth = labelWidth1;
    this.rejectBrightestPercent_Control.toolTip = "<p>Rejects samples that contain bright objects. The brightness is relative to the samples background level.</p>";
    this.rejectBrightestPercent_Control.onValueUpdated = function (value) {
        data.rejectBrightestPercent = value;
    };
    this.rejectBrightestPercent_Control.setRange(0, 90);
    this.rejectBrightestPercent_Control.slider.setRange(0, 90);
    this.rejectBrightestPercent_Control.setPrecision(0);
    this.rejectBrightestPercent_Control.slider.minWidth = 500;
    this.rejectBrightestPercent_Control.setValue(data.rejectBrightestPercent);

    const helpWindowTitle = TITLE + "." + VERSION;
    const HELP_MSG =
            "<p>Apply a gradient to the target image so that it matches the reference image. The default parameters should work well. " +
            "Adjust the 'Sample Size' if your images are over or under sampled.</p>" +
            "<p>The 'CCD Linear Range' rejects all sample squares that contain a sample above this level. " +
            "This ensures that only the linear part of the CCD's range is used.</p>" +
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
    this.sizer.add(this.rejectBrightestPercent_Control);
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
        break;
    }

    return;
}

main();
