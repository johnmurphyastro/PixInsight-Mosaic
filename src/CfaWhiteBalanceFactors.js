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
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"

function VERSION(){return "1.0";}
function TITLE(){return "CFA White Balance Factors";}

/**
 * @param {LinearFitData} linearFit
 * @param {Number} nPixels
 * @param {Number} bayerPixel
 * @param {Number} rejectHigh
 * @returns {undefined}
 */
function displayConsoleInfo(linearFit, nPixels, bayerPixel, rejectHigh) {
    console.writeln("Pixel = ", bayerPixel);
    console.writeln("  Pixels: ", nPixels, ", Reject high: ", rejectHigh);
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
    let rawView = data.rawView;
    let wbView = data.wbView;
    let linearFit = []; // linear fit details (m and b) for all bayer pixels
    let bayerCfaPairs = []; // Array of CfaPair[], one for each of the 4 bayer pixels
//    let nChannels = 4;      // 0 = top left, 1 = top right, 2 = bottom left, 3 = bottom right
    if (rawView.image.isColor || wbView.image.isColor) {
        new MessageBox("Error: both images must be CFA", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }

    console.writeln("CFA White Balanced Raw: ", wbView.fullId, ", CFA Pure Raw: ", rawView.fullId);

    // For each pixel in the bayer block of 4
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let bayerPixel = 0; bayerPixel < 4; bayerPixel++) {
        let leastSquaresFit = new LeastSquareFitAlgorithm();
        let cfaPairs = createCfaPairs(rawView.image, wbView.image, bayerPixel, data.rejectHigh);
        for (let cfaPair of cfaPairs){
            leastSquaresFit.addValue(cfaPair.rawValue, cfaPair.wbValue);
        }
        linearFit[bayerPixel] = leastSquaresFit.getLinearFit();
        bayerCfaPairs[bayerPixel] = cfaPairs;
        displayConsoleInfo(linearFit[bayerPixel], cfaPairs.length, bayerPixel, data.rejectHigh);
    }
    displayWhiteBalance(linearFit);

    if (data.displayGraphFlag) {
        console.writeln("\nCreating least squares fit graph");
        displayGraph(rawView, wbView, 730, bayerCfaPairs, linearFit);
    }
    data.saveParameters();
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
}

function CfaPair(rawValue, wbValue){
    this.rawValue = rawValue;
    this.wbValue = wbValue;
}

/**
 * Create CfaPair array.
 * If either the 'pure raw' or 'white balance raw' value is black sample or
 * greater than rejectHigh, the CfaPair is not added to the array.
 *
 * @param {Image} rawImage
 * @param {Image} wbImage
 * @param {Number} bayerPixel This number Indicates the bayer array position (0, 1, 2, 3)
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @return {cfaPair[]} Array of target and reference binned sample values
 */
function createCfaPairs(rawImage, wbImage, bayerPixel, rejectHigh) {
    // Divide the images into blocks specified by sampleSize.
    let w = wbImage.width;
    let h = wbImage.height;
    let firstY = bayerPixel < 2 ? 0 : 1;
    let firstX;
    if (bayerPixel === 1 || bayerPixel === 3){
        firstX = 0;
    } else {
        firstX = 1;
    }

    /**
     * @param sample Pixel value to check
     * @param rejectHigh Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, rejectHigh) => sample === 0 || sample > rejectHigh;

    let cfaPairArray = [];
    for (let y = firstY; y < h; y+=2) {
        for (let x = firstX; x < w; x+=2) {
            let rawValue = rawImage.sample(x, y, 0);
            if (isBlackOrClipped(rawValue, rejectHigh)) {
                continue;
            }
            let wbValue = wbImage.sample(x, y, 0);
            if (isBlackOrClipped(wbValue, rejectHigh)) {
                continue;
            }
            let pair = new CfaPair(rawValue, wbValue);
            cfaPairArray.push(pair);
        }
    }

    return cfaPairArray;
}

/**
 * @param {View} rawView
 * @param {View} wbView
 * @param {Number} height
 * @param {CfaPair[][]} bayerCfaPairs Array of CfaPair[], one for each bayer pixel
 * @param {LinearFitData[]} linearFit Least Squares Fit each bayer pixel
 * @returns {undefined}
 */
function displayGraph(rawView, wbView, height, bayerCfaPairs, linearFit){
    let imageWindow = null;
    let windowTitle = rawView.fullId + "_to_" + wbView.fullId + "_LeastSquaresFit";
    let rawLabel = "Pure RAW (" + rawView.fullId + ") pixel value";
    let wbLabel = "White Balanced RAW (" + wbView.fullId + ") pixel value";
    
    // Create the graph axis and annotation.
    let rawMin = rawView.image.minimum();
    let rawMax = rawView.image.maximum();
    let wbMin = wbView.image.minimum();
    let wbMax = wbView.image.maximum();
    let graphWithAxis = new Graph(rawMin, wbMin, rawMax, wbMax);
    //let graphWithAxis = new Graph(0, 0, minMax.maxTargetMean, minMax.maxReferenceMean);
    graphWithAxis.setYAxisLength(height);
    graphWithAxis.createGraph(rawLabel, wbLabel);

    // Now add the data to the graph...
    // Color. Need to create 4 graphs for r, g, g, b and then merge them (binary OR) so that
    // if three samples are on the same pixel we get white and not the last color drawn
    let lineColors = [0xFF770000, 0xFF007700, 0xFF007700, 0xFF000077]; // r, g, b
    let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF00FF00, 0xFF0000FF]; // r, g, b
    for (let c = 0; c < bayerCfaPairs.length; c++) {
        let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
        drawLineAndPoints(graphAreaOnly, linearFit[c], lineColors[c], bayerCfaPairs[c], pointColors[c]);
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
 * @param {CfaPair[]} cfaPairs The array of CfaPair
 * @param {Number} pointColor e.g. 0xAARRGGBB
 * @returns {undefined}
 */
function drawLineAndPoints(graph, linearFit, lineColor, cfaPairs, pointColor){
    graph.drawLine(linearFit.m, linearFit.b, lineColor);
    for (let cfaPair of cfaPairs){
        graph.drawPoint(cfaPair.rawValue, cfaPair.wbValue, pointColor);
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
        if (this.rawView.isMainView) {
            Parameters.set("rawView", this.rawView.fullId);
        }
        if (this.wbView.isMainView) {
            Parameters.set("wbView", this.wbView.fullId);
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
        if (Parameters.has("rawView")) {
            let viewId = Parameters.getString("rawView");
            this.rawView = View.viewById(viewId)
        }
        if (Parameters.has("wbView")) {
            let viewId = Parameters.getString("wbView");
            this.wbView = View.viewById(viewId)
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
    this.wbView = getDefaultView(activeWindow, "wb");
    this.rawView = getDefaultView(activeWindow, "raw");
    
    // Initialise the script's data
    this.setParameters();
}

// The main dialog function
function cfaLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Set some basic widths from dialog text
    let labelWidth1 = this.font.width("White Balanced RAW:_");

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            "</b> &mdash; Determines CFA white balance factors.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let wbImage_Label = new Label(this);
    wbImage_Label.text = "White Balanced RAW:";
    wbImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    wbImage_Label.minWidth = labelWidth1;

    this.wbImage_ViewList = new ViewList(this);
    this.wbImage_ViewList.getMainViews();
    this.wbImage_ViewList.minWidth = 300;
    this.wbImage_ViewList.currentView = data.wbView;
    this.wbImage_ViewList.toolTip = "<p>Select the colour balanced CFA image</p>";
    this.wbImage_ViewList.onViewSelected = function (view) {
        data.wbView = view;
    };

    let wbImage_Sizer = new HorizontalSizer;
    wbImage_Sizer.spacing = 4;
    wbImage_Sizer.add(wbImage_Label);
    wbImage_Sizer.add(this.wbImage_ViewList, 100);

    //-------------------------------------------------------
    // Create the target image field
    //-------------------------------------------------------
    let rawImage_Label = new Label(this);
    rawImage_Label.text = "Pure RAW:";
    rawImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    rawImage_Label.minWidth = labelWidth1;

    this.rawImage_ViewList = new ViewList(this);
    this.rawImage_ViewList.getMainViews();
    this.rawImage_ViewList.minWidth = 300;
    this.rawImage_ViewList.currentView = data.rawView;
    this.rawImage_ViewList.toolTip = "<p>Select the RAW CFA image</p>";
    this.rawImage_ViewList.onViewSelected = function (view) {
        data.rawView = view;
    };

    let rawImage_Sizer = new HorizontalSizer;
    rawImage_Sizer.spacing = 4;
    rawImage_Sizer.add(rawImage_Label);
    rawImage_Sizer.add(this.rawImage_ViewList, 100);


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
    rejectHigh_Control.setRange(0.1, 1.0);
    rejectHigh_Control.slider.setRange(1, 1000);
    rejectHigh_Control.setPrecision(2);
    rejectHigh_Control.slider.minWidth = 300;
    rejectHigh_Control.setValue(data.rejectHigh);

    const helpWindowTitle = TITLE() + " v" + VERSION();

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
    this.sizer.add(wbImage_Sizer);
    this.sizer.add(rawImage_Sizer);
    this.sizer.add(algorithm_Sizer);
    this.sizer.add(rejectHigh_Control);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
cfaLinearFitDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {
//    testLeastSquareFitAlgorithm();

    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
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
        console.writeln("<b>CFA White Balance Factors ", VERSION(), "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.rawView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.wbView.isNull) {
            (new MessageBox("WARNING: Reference view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.rawView.image.isColor !== data.wbView.image.isColor) {
            (new MessageBox("ERROR: Cannot linear fit a B&W image with a colour image", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.rawView.image.width !== data.wbView.image.width ||
                data.rawView.image.height !== data.wbView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
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
