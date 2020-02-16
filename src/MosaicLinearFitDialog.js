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
#feature-id Utilities > mosaicLinearFit

#feature-info Linear fits target and reference images over the overlaping area.<br/>\
Copyright &copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>

#include "DialogLib.js"
#include "LinearFitLib.js"
#include "LinearFitGraph.js"

#define VERSION  "1.0"
#define TITLE "Mosaic Linear Fit"
#define MOSAIC_NAME "Mosaic"

function displayConsoleInfo(linearFit, nSamples, channel, rejectHigh, sampleSize) {
    console.writeln("Channel = ", channel);
    console.writeln("  Samples: ", nSamples, ", Size: ", sampleSize, ", Reject high: ", rejectHigh);
    console.writeln("  Linear Fit:  m = ", linearFit.m.toPrecision(5), ", b = ", linearFit.b.toPrecision(5));
}

/**
 * Controller. Processing starts here!
 * @param {MosaicLinearFitData} data Values from user interface
 */
function mosaicLinearFit(data)
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
    let samplePreviewArea;
    if (data.hasAreaOfInterest){
        samplePreviewArea = new Rectangle(data.areaOfInterest_X, data.areaOfInterest_Y, data.areaOfInterest_W, data.areaOfInterest_H);
    } else {
        samplePreviewArea = new Rectangle(0, 0, targetView.image.width, targetView.image.height);
    }

    // For each channel (L or RGB)
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let channel = 0; channel < nChannels; channel++) {
        colorSamplePairArray[channel] = createSamplePairs(targetView.image, referenceView.image,
                channel, data.sampleSize, data.rejectHigh, false, 0, samplePreviewArea);
        if (colorSamplePairArray[channel].length < 2) {
            new MessageBox("Error: Too few samples to determine a linear fit.", TITLE, StdIcon_Error, StdButton_Ok).execute();
            return false;
        }

        linearFit[channel] = calculateLinearFit(colorSamplePairArray[channel], getLinearFitX, getLinearFitY);
        displayConsoleInfo(linearFit[channel], colorSamplePairArray[channel].length,
                channel, data.rejectHigh, data.sampleSize);
    }

    if (data.displayGraphFlag) {
        console.writeln("\nCreating linear fit graph");
        let title = "LinearFit_" + targetView.fullId;
        let graph = new Graph(title, getLinearFitX, getLinearFitY);
        let imageWindow = graph.createLinearFitWindow(colorSamplePairArray, nChannels, 1000);
        graph.displayGraphWindow(imageWindow, nChannels, linearFit, colorSamplePairArray);
    }
    
    if (data.displaySamplesFlag){
        let title = "Samples_" + targetView.fullId;
        let samplesWindow = drawSampleSquares(colorSamplePairArray, data.sampleSize, referenceView, title);
        samplesWindow.show();
    }
    
    console.writeln("\nApplying linear fit");
    applyLinearFit(targetView, linearFit);

    if (data.displayMosiacFlag) {
        console.writeln("\nCreating " + MOSAIC_NAME);
        createMosaic(referenceView, targetView, data.mosaicOverlayFlag, MOSAIC_NAME);
    }
    data.saveParameters();
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
    return true;
}

/**
 * Default the Reference view to the open view named "Mosaic".
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view)
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultReferenceView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let referenceView = null;
    for (let win of allWindows) {
        if (win.currentView.fullId.toLowerCase().contains("mosaic")) {
            referenceView = win.currentView;
            break;
        }
    }
    if (null === referenceView) {
        for (let win of allWindows) {
            if (activeWindow.currentView.fullId !== win.currentView.fullId) {
                referenceView = win.currentView;
                break;
            }
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
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("displayGraphFlag", this.displayGraphFlag);
        Parameters.set("displaySamplesFlag", this.displaySamplesFlag);
        Parameters.set("displayMosiacFlag", this.displayMosiacFlag);
        Parameters.set("mosiacOverlayFlag", this.mosaicOverlayFlag);
        
        Parameters.set("hasAreaOfInterest", this.hasAreaOfInterest);
        Parameters.set("areaOfInterestX", this.areaOfInterest_X);
        Parameters.set("areaOfInterestY", this.areaOfInterest_Y);
        Parameters.set("areaOfInterestW", this.areaOfInterest_W);
        Parameters.set("areaOfInterestH", this.areaOfInterest_H);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");    
        if (Parameters.has("displayGraphFlag"))
            this.displayGraphFlag = Parameters.getBoolean("displayGraphFlag");
        if (Parameters.has("displaySamplesFlag"))
            this.displaySamplesFlag = Parameters.getBoolean("displaySamplesFlag");
        if (Parameters.has("displayMosiacFlag"))
            this.displayMosiacFlag = Parameters.getBoolean("displayMosiacFlag");
        if (Parameters.has("mosiacOverlayFlag")) {
            this.mosaicOverlayFlag = Parameters.getBoolean("mosiacOverlayFlag");
            this.mosaicRandomFlag = !(this.mosaicOverlayFlag);
        }
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId)
        }
        
        if (Parameters.has("hasAreaOfInterest"))
            this.hasAreaOfInterest = Parameters.getBoolean("hasAreaOfInterest");
        if (Parameters.has("areaOfInterestX")){
            this.areaOfInterest_X = Parameters.getInteger("areaOfInterestX"); 
        }
        if (Parameters.has("areaOfInterestY")){
            this.areaOfInterest_Y = Parameters.getInteger("areaOfInterestY"); 
        }
        if (Parameters.has("areaOfInterestW")){
            this.areaOfInterest_W = Parameters.getInteger("areaOfInterestW"); 
        }
        if (Parameters.has("areaOfInterestH")){
            this.areaOfInterest_H = Parameters.getInteger("areaOfInterestH"); 
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.rejectHigh = 0.5;
        this.sampleSize = 15;
        this.displayGraphFlag = false;
        this.displaySamplesFlag = false;
        this.displayMosiacFlag = true;
        this.mosaicOverlayFlag = true;
        this.mosaicRandomFlag = false;
        
        this.hasAreaOfInterest = false;
        this.areaOfInterest_X = 0;
        this.areaOfInterest_Y = 0;
        this.areaOfInterest_W = 0;
        this.areaOfInterest_H = 0;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.displaySampleControl.checked = this.displaySamplesFlag;
        linearFitDialog.displayMosaicControl.checked = this.displayMosiacFlag;
        linearFitDialog.mosaicOverlayControl.checked = this.mosaicOverlayFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        
        linearFitDialog.areaOfInterestCheckBox.checked = this.hasAreaOfInterest;
        linearFitDialog.rectangleX_Control.setValue(this.areaOfInterest_X);
        linearFitDialog.rectangleY_Control.setValue(this.areaOfInterest_Y);
        linearFitDialog.rectangleW_Control.setValue(this.areaOfInterest_W);
        linearFitDialog.rectangleH_Control.setValue(this.areaOfInterest_H);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultReferenceView(activeWindow);
    if (!activeWindow.isNull) {
        this.targetView = activeWindow.currentView;
    }
    // Initialise the script's data
    this.setParameters();
}

function setTargetPreview(previewImage_ViewList, data, targetView){
    let previews = targetView.window.previews;
    if (previews.length > 0) {
        previewImage_ViewList.currentView = previews[0];
        data.preview = previews[0];
    }
}

/**
 * 
 * @param {String} label
 * @param {String} tooltip
 * @param {Number} initialValue
 * @param {Number} labelWidth
 * @param {Number} editWidth
 * @returns {NumericEdit}
 */
function createNumericEdit(label, tooltip, initialValue, labelWidth, editWidth){
    let numericEditControl = new NumericEdit();
    numericEditControl.setReal(false);
    numericEditControl.setRange(0, 100000);
    numericEditControl.setValue(initialValue);
    numericEditControl.label.text = label;
    numericEditControl.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
//    numericEditControl.label.setFixedWidth(labelWidth);
    numericEditControl.edit.setFixedWidth(editWidth);
    numericEditControl.toolTip = tooltip;
    return numericEditControl;
}

// The main dialog function
function mosaicLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Set some basic widths from dialog text
    let labelWidth1 = this.font.width("CCD linear range:_");

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
    this.referenceImage_ViewList.getMainViews();
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
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select an image to generate a PSF for</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
        setTargetPreview(this.dialog.previewImage_ViewList, data, view);
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);


    //-------------------------------------------------------
    // Linear Fit Method Field
    //-------------------------------------------------------
    let algorithm_Label = new Label(this);
    algorithm_Label.text = "LinearFit:";
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
    
    this.displaySampleControl = new CheckBox(this);
    this.displaySampleControl.text = "Display Samples";
    this.displaySampleControl.toolTip = "Display the sample squares";
    this.displaySampleControl.checked = data.displaySamplesFlag;
    this.displaySampleControl.onClick = function (checked) {
        data.displaySamplesFlag = checked;
    };

    let algorithm_Sizer = new HorizontalSizer;
    algorithm_Sizer.spacing = 4;
    algorithm_Sizer.add(algorithm_Label);
    algorithm_Sizer.add(this.displayGraphControl);
    algorithm_Sizer.addSpacing(20);
    algorithm_Sizer.add(this.displaySampleControl);
    algorithm_Sizer.addStretch();

    //-------------------------------------------------------
    // Mosaic
    //-------------------------------------------------------
    let mosaic_Label = new Label(this);
    mosaic_Label.text = "Mosaic:";
    mosaic_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    mosaic_Label.minWidth = labelWidth1;

    this.displayMosaicControl = new CheckBox(this);
    this.displayMosaicControl.text = "Create Mosaic";
    this.displayMosaicControl.toolTip = "Adds reference & target frames and displays in a 'MosaicTest' window";
    this.displayMosaicControl.checked = data.displayMosiacFlag;
    this.displayMosaicControl.onClick = function (checked) {
        data.displayMosiacFlag = checked;
    };

    this.mosaicOverlayControl = new RadioButton(this);
    this.mosaicOverlayControl.text = "Overlay";
    this.mosaicOverlayControl.toolTip = "Overlays reference image on top of the target image";
    this.mosaicOverlayControl.checked = data.mosaicOverlayFlag;
    this.mosaicOverlayControl.onClick = function (checked) {
        data.mosaicOverlayFlag = checked;
        data.mosaicRandomFlag = !checked;
    };

    this.mosaicRandomControl = new RadioButton(this);
    this.mosaicRandomControl.text = "Random";
    this.mosaicRandomControl.toolTip = "Randomly choose pixels from the reference and target image";
    this.mosaicRandomControl.checked = data.mosaicRandomFlag;
    this.mosaicRandomControl.onClick = function (checked) {
        data.mosaicRandomFlag = checked;
        data.mosaicOverlayFlag = !checked;
    };

    let mosaic_Sizer = new HorizontalSizer;
    mosaic_Sizer.spacing = 4;
    mosaic_Sizer.add(mosaic_Label);
    mosaic_Sizer.add(this.displayMosaicControl);
    mosaic_Sizer.addSpacing(20);
    mosaic_Sizer.add(this.mosaicOverlayControl);
    mosaic_Sizer.add(this.mosaicRandomControl);
    mosaic_Sizer.addStretch();

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
    
    // Area of interest
    let labelWidth2 = this.font.width("Height:_");
    let areaOfInterest_GroupBox = new GroupBox(this);
    areaOfInterest_GroupBox.title = "Area of Interest";
    areaOfInterest_GroupBox.sizer = new VerticalSizer;
    areaOfInterest_GroupBox.sizer.margin = 6;
    areaOfInterest_GroupBox.sizer.spacing = 6;
    
    this.rectangleX_Control = createNumericEdit("Left:", "Top left of rectangle X-Coordinate.", data.areaOfInterest_X, labelWidth2, 50);
    this.rectangleX_Control.onValueUpdated = function (value){
        data.areaOfInterest_X = value;
    };
    this.rectangleY_Control = createNumericEdit("Top:", "Top left of rectangle Y-Coordinate.", data.areaOfInterest_Y, labelWidth2, 50);
    this.rectangleY_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y = value;
    };
    this.rectangleW_Control = createNumericEdit("Width:", "Rectangle width.", data.areaOfInterest_W, labelWidth2, 50);
    this.rectangleW_Control.onValueUpdated = function (value){
        data.areaOfInterest_W = value;
    };
    this.rectangleH_Control = createNumericEdit("Height:", "Rectangle height.", data.areaOfInterest_H, labelWidth2, 50);
    this.rectangleH_Control.onValueUpdated = function (value){
        data.areaOfInterest_H = value;
    };
    
    this.areaOfInterestCheckBox = new CheckBox(this);
    this.areaOfInterestCheckBox.text = "Limit samples to area of interest";
    this.areaOfInterestCheckBox.toolTip = "Limit samples to area of interest";
    this.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
    this.areaOfInterestCheckBox.onClick = function (checked) {
        data.hasAreaOfInterest = checked;
    };
    
    let coordHorizontalSizer = new HorizontalSizer;
    coordHorizontalSizer.spacing = 30;
    coordHorizontalSizer.add(this.rectangleX_Control);
    coordHorizontalSizer.add(this.rectangleY_Control);
    coordHorizontalSizer.add(this.rectangleW_Control);
    coordHorizontalSizer.add(this.rectangleH_Control);
    coordHorizontalSizer.addStretch();

    // Area of interest Target->preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = "Get area from preview:";
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    previewImage_Label.minWidth = labelWidth1;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Get area of interest from preview image.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        data.preview = view;
    };
    setTargetPreview(this.previewImage_ViewList, data, data.targetView);
    
    let previewUpdateButton = new PushButton();
    previewUpdateButton.hasFocus = false;
    previewUpdateButton.text = "Update";
    previewUpdateButton.onClick = function () {
        if (!this.isUnderMouse){
            // Ensure pressing return in a different field does not trigger this callback!
            return;
        }
        let view = data.preview;
        if (view.isPreview) {
            data.hasAreaOfInterest = true;
            this.dialog.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
            ///let imageWindow = view.window;
            let rect = view.window.previewRect(view);
            data.areaOfInterest_X = rect.x0;
            data.areaOfInterest_Y = rect.y0;
            data.areaOfInterest_W = rect.width;
            data.areaOfInterest_H = rect.height;
            
            // Console.writeln("Preview rectangle: (" + rect.x0 + "," + rect.y0 + ") (" + rect.x1 + "," + rect.y1 + ") Width: " + rect.width + " Height: " + rect.height);
            this.dialog.rectangleX_Control.setValue(data.areaOfInterest_X);
            this.dialog.rectangleY_Control.setValue(data.areaOfInterest_Y);
            this.dialog.rectangleW_Control.setValue(data.areaOfInterest_W);
            this.dialog.rectangleH_Control.setValue(data.areaOfInterest_H);
        }
    };

    let previewImage_Sizer = new HorizontalSizer;
    previewImage_Sizer.spacing = 4;
    previewImage_Sizer.add(previewImage_Label);
    previewImage_Sizer.add(this.previewImage_ViewList, 100);
    previewImage_Sizer.addSpacing(10);
    previewImage_Sizer.add(previewUpdateButton);

    areaOfInterest_GroupBox.sizer.add(this.areaOfInterestCheckBox);
    areaOfInterest_GroupBox.sizer.add(coordHorizontalSizer, 10);
    areaOfInterest_GroupBox.sizer.add(previewImage_Sizer);

    const helpWindowTitle = TITLE + "." + VERSION;
    const HELP_MSG =
            "<p>Apply a scale and offset to the target image so that it matches the reference image. The default parameters should work well. " +
            "Adjust the 'Sample Size' if your images are over or under sampled.</p>" +
            "<p>The 'LinearFit Method' is 'Least Squares'.</p>" +
            "<p>The optional graph displays the sample points and the best fit line.</p>" +
            "<p>The optional test mosaic is used to visually judge how well the target image was scaled.</p>" +
            "<p>The 'CCD Linear Range' rejects all sample squares that contain a sample above this level. " +
            "This ensures that only the linear part of the CCD's range is used.</p>" +
            "The 'Reject Brightest' rejects the N brightest samples. These samples are likely to contain " +
            "bright stars. Increase this if the samples diverge from the fitted line at the top right of the graph.</p>" +
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
    this.sizer.add(algorithm_Sizer);
    this.sizer.add(mosaic_Sizer);
    this.sizer.add(this.rejectHigh_Control);
    this.sizer.add(this.sampleSize_Control);
    this.sizer.addSpacing(10);
    this.sizer.add(areaOfInterest_GroupBox);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
mosaicLinearFitDialog.prototype = new Dialog;

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

    let linearFitDialog = new mosaicLinearFitDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>Mosaic Linear Fit ", VERSION, "</b>:");

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
        let ok = mosaicLinearFit(data);
        if (!ok){
            // Give the user a chance to correct the error
            continue;
        }
        
        console.hide();

        // Quit after successful execution.
        break;
    }

    return;
}

main();
