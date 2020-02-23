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
#feature-id Utilities > cfaFlatColorCorrection

#feature-info Determines CFA white balance factors.<br/>\
Copyright &copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogLib.js"
#include "lib/SamplePair.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"

#define VERSION  "1.0"
#define TITLE "CFA White Balance Factors"

/**
 * @param {LinearFitData} linearFit
 * @param {Number} nSamples
 * @param {Number} channel
 * @param {Number} rejectHigh
 * @returns {undefined}
 */
function displayConsoleInfo(linearFit, nSamples, channel, rejectHigh) {
    console.writeln("Pixel = ", channel);
    console.writeln("  Samples: ", nSamples, ", Reject high: ", rejectHigh);
    console.writeln("  Linear Fit:  m = ", linearFit.m.toPrecision(5), ", b = ", linearFit.b.toPrecision(5));
}

/**
 * @param {LinearFitData} linearFit
 * @returns {undefined}
 */
function displayWhiteBalance(linearFit){
    let minGradient = Math.min(linearFit[0].m, linearFit[1].m, linearFit[2].m, linearFit[3].m);
    console.writeln("\nColor balance: ");
    console.writeln("Top Left    : " + (linearFit[1].m / minGradient).toPrecision(7));
    console.writeln("Top Right   : " + (linearFit[0].m / minGradient).toPrecision(7));
    console.writeln("Bottom Right: " + (linearFit[2].m / minGradient).toPrecision(7));
    console.writeln("Bottom Left : " + (linearFit[3].m / minGradient).toPrecision(7));
}

/**
 * Controller. Processing starts here!
 * @param {MosaicLinearFitData} data Values from user interface
 */
function cfaLinearFit(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let referenceView = data.referenceView;
    let linearFit = []; // linear fit details (m and b) for all channels
    let colorSamplePairs = []; // SamplePairs[channel]
    let nChannels = 4;      // 0 = top left, 1 = top right, 2 = bottom left, 3 = bottom right
    if (targetView.image.isColor || referenceView.image.isColor) {
        new MessageBox("Error: both images must be CFA", TITLE, StdIcon_Error, StdButton_Ok).execute();
        return;
    }

    console.writeln("CFA Reference: ", referenceView.fullId, ", CFA Raw: ", targetView.fullId);

    // For each channel (L or RGB)
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let channel = 0; channel < nChannels; channel++) {
        let samplePairs = createCfaSamplePairs(targetView.image, referenceView.image,
                channel, data.rejectHigh);
        if (samplePairs.samplePairArray.length < 2) {
            new MessageBox("Error: Too few samples to determine a linear fit.", TITLE, StdIcon_Error, StdButton_Ok).execute();
            return;
        }

        linearFit[channel] = calculateLinearFit(samplePairs.samplePairArray, getLinearFitX, getLinearFitY);
        displayConsoleInfo(linearFit[channel], samplePairs.samplePairArray.length,
                channel, data.rejectHigh);
        colorSamplePairs[channel] = samplePairs;
    }
    displayWhiteBalance(linearFit);

    if (data.displayGraphFlag) {
        console.writeln("\nCreating least squares fit graph");
        displayGraph(targetView.fullId, referenceView.fullId, 730, colorSamplePairs, linearFit);
    }
    data.saveParameters();
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * @param {String} targetName
 * @param {String} referenceName
 * @param {Number} height
 * @param {SamplePairs[]} colorSamplePairs SamplePairs for L or R,G,B
 * @param {LinearFitData[]} linearFit Least Squares Fit for L or R,G,B
 * @returns {undefined}
 */
function displayGraph(targetName, referenceName, height, colorSamplePairs, linearFit){
    let imageWindow = null;
    let windowTitle = targetName + "_to_" + referenceName + "_LeastSquaresFit";
    let targetLabel = "Pure RAW (" + targetName + ") sample value";
    let referenceLabel = "White Balance RAW (" + referenceName + ") sample value";
    
    // Create the graph axis and annotation.
    let minMax = new SamplePairMinMax();
    colorSamplePairs.forEach(function (samplePairs) {
        minMax.calculateMinMax(samplePairs.samplePairArray);
    });
    let graphWithAxis = new Graph(minMax.minTargetMean, minMax.minReferenceMean, minMax.maxTargetMean, minMax.maxReferenceMean);
    //let graphWithAxis = new Graph(0, 0, minMax.maxTargetMean, minMax.maxReferenceMean);
    graphWithAxis.setYAxisLength(height);
    graphWithAxis.createGraph(targetLabel, referenceLabel);

    // Now add the data to the graph...
    // Color. Need to create 4 graphs for r, g, g, b and then merge them (binary OR) so that
    // if three samples are on the same pixel we get white and not the last color drawn
    let lineColors = [0xFF770000, 0xFF007700, 0xFF007700, 0xFF000077]; // r, g, b
    let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF00FF00, 0xFF0000FF]; // r, g, b
    for (let c = 0; c < colorSamplePairs.length; c++) {
        let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
        drawLineAndPoints(graphAreaOnly, linearFit[c], lineColors[c], colorSamplePairs[c], pointColors[c]);
        graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
    }
    imageWindow = graphWithAxis.createWindow(windowTitle, true);
    imageWindow.show();
}

/**
 * Draw graph lines and points for a single color
 * @param {Graph} graph
 * @param {LinearFitData} linearFit
 * @param {Number} lineColor e.g. 0xAARRGGBB
 * @param {SamplePairs} samplePairs Contains the array of SamplePair
 * @param {Number} pointColor e.g. 0xAARRGGBB
 * @returns {undefined}
 */
function drawLineAndPoints(graph, linearFit, lineColor, samplePairs, pointColor){
    graph.drawLine(linearFit.m, linearFit.b, lineColor);
    for (let samplePair of samplePairs.samplePairArray){
        graph.drawPoint(samplePair.targetMean, samplePair.referenceMean, pointColor);
    }
}

/**
 * Return the view with 'searchString' in its ID.
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view)
 * @param {ImageWindow} activeWindow
 * @param {String} searchString Look for a window ID that contains this string
 * @return {View} default view
 */
function getDefaultView(activeWindow, searchString) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let view = null;
    
    for (let win of allWindows) {
        if (win.currentView.fullId.toLowerCase().contains(searchString)) {
            view = win.currentView;
            break;
        }
    }
    
    if (null === view) {
        if (!activeWindow.isNull) {
            view = activeWindow.currentView;
        }
    }
    return view;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function cfaLinearFitData() {
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
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("displayGraphFlag", this.displayGraphFlag);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("displayGraphFlag"))
            this.displayGraphFlag = Parameters.getBoolean("displayGraphFlag");
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
        this.rejectHigh = 0.8;
        this.displayGraphFlag = false;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultView(activeWindow, "wb");
    this.targetView = getDefaultView(activeWindow, "raw");
    
    // Initialise the script's data
    this.setParameters();
}

// The main dialog function
function cfaLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Set some basic widths from dialog text
    let labelWidth1 = this.font.width("RAW (White Balance):_");

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION +
            "</b> &mdash; Determines CFA white balance factors.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "RAW (White Balance):";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = labelWidth1;

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getMainViews();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = "<p>Select the colour balanced CFA image</p>";
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
    targetImage_Label.text = "Pure RAW:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select the RAW CFA image</p>";
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
    algorithm_Label.text = "Least Squares Fit:";
    algorithm_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    algorithm_Label.minWidth = labelWidth1;

    //-------------------------------------------------------
    // Display Graph, Display Test Mosaic
    //-------------------------------------------------------
    this.displayGraphControl = new CheckBox(this);
    this.displayGraphControl.text = "Dispaly Graph";
    this.displayGraphControl.toolTip = "Displays the sample points and their best fit line";
    this.displayGraphControl.checked = data.displayGraphFlag;
    this.displayGraphControl.onClick = function (checked) {
        data.displayGraphFlag = checked;
    };

    let algorithm_Sizer = new HorizontalSizer;
    algorithm_Sizer.spacing = 4;
    algorithm_Sizer.add(algorithm_Label);
    algorithm_Sizer.add(this.displayGraphControl);
    algorithm_Sizer.addStretch();

    //-------------------------------------------------------
    // Rejection High
    //-------------------------------------------------------
    let rejectHigh_Control = new NumericControl(this);
    rejectHigh_Control.real = true;
    rejectHigh_Control.label.text = "CCD Linear Range:";
    rejectHigh_Control.label.minWidth = labelWidth1;
    rejectHigh_Control.toolTip = "<p>Only use pixels within CCD's linear range. 0.5 works well.</p>";
    rejectHigh_Control.onValueUpdated = function (value) {
        data.rejectHigh = value;
    };
    rejectHigh_Control.setRange(0.001, 1.0);
    rejectHigh_Control.slider.setRange(0, 5000);
    rejectHigh_Control.setPrecision(4);
    rejectHigh_Control.slider.minWidth = 500;
    rejectHigh_Control.setValue(data.rejectHigh);

    const helpWindowTitle = TITLE + " v" + VERSION;

    // Help button
    const HELP_MSG =
            "<p>Not yet implemented</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, HELP_MSG);

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
    this.sizer.add(algorithm_Sizer);
    this.sizer.add(rejectHigh_Control);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
cfaLinearFitDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {
//    testLeastSquareFitAlgorithm();

    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new cfaLinearFitData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new cfaLinearFitDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>CFA White Balance Factors ", VERSION, "</b>:");

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
        cfaLinearFit(data);

        // Quit after successful execution.
        break;
    }

    return;
}

main();
