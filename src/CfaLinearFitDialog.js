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
#feature-id Utilities > cfaLinearFit

#feature-info Linear fits target and reference images.<br/>\
Copyright &copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/UndoFlag.jsh>

#include "LinearFitLib.js"
#include "LinearFitGraph.js"

#define VERSION  "1.0"
#define TITLE "CFA colour balance (Linear Fit)"
#define MOSAIC_NAME "Mosaic"

function displayConsoleInfo(linearFit, channel, rejectHigh) {
    console.writeln("Pixel = ", channel);
    console.writeln("  Reject high: ", rejectHigh);
    console.writeln("  Linear Fit:  m = ", linearFit.m.toPrecision(5), ", b = ", linearFit.b.toPrecision(5));
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
    let samplePairArray = []; // SamplePair[channel][SamplePairArray]
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
        samplePairArray[channel] = createCfaSamplePairs(targetView.image, referenceView.image,
                channel, data.rejectHigh);
        if (samplePairArray[channel].length < 2) {
            new MessageBox("Error: Too few samples to determine a linear fit.", TITLE, StdIcon_Error, StdButton_Ok).execute();
            return;
        }

        linearFit[channel] = calculateLinearFit(samplePairArray[channel], getLinearFitX, getLinearFitY);
        displayConsoleInfo(linearFit[channel], channel, data.rejectHigh);
    }

    if (data.displayGraphFlag) {
        console.writeln("\nCreating linear fit graph");
        let title = "LinearFit_" + targetView.fullId;
        let graph = new Graph(title, getLinearFitX, getLinearFitY);
        let imageWindow = graph.createLinearFitWindow(samplePairArray, nChannels, 1000);
        graph.displayGraphWindow(imageWindow, nChannels, linearFit, samplePairArray);
    }
    
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
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
        if (MOSAIC_NAME === win.currentView.fullId) {
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
        this.rejectHigh = 0.9;
        this.displayGraphFlag = false;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
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
function cfaLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    //-------------------------------------------------------
    // Set some basic widths from dialog text
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("CCD linear range:_");

    //-------------------------------------------------------
    // Create the Program Discription at the top
    //-------------------------------------------------------
    this.helpLabel = new Label(this);
    this.helpLabel.frameStyle = FrameStyle_Box;
    this.helpLabel.margin = 4;
    this.helpLabel.wordWrapping = true;
    this.helpLabel.useRichText = true;
    this.helpLabel.text = "<b>" + TITLE + " v" + VERSION + "</b> &mdash; Linear fits target and reference images.";

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    this.referenceImage_Label = new Label(this);
    this.referenceImage_Label.text = "Reference View:";
    this.referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    this.referenceImage_Label.minWidth = labelWidth1;

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getAll();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = "<p>Select the colour balanced CFA image</p>";
    this.referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };

    this.referenceImage_Sizer = new HorizontalSizer;
    this.referenceImage_Sizer.spacing = 4;
    this.referenceImage_Sizer.add(this.referenceImage_Label);
    this.referenceImage_Sizer.add(this.referenceImage_ViewList, 100);

    //-------------------------------------------------------
    // Create the target image field
    //-------------------------------------------------------
    this.targetImage_Label = new Label(this);
    this.targetImage_Label.text = "Target View:";
    this.targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    this.targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getAll();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select the RAW CFA image</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    this.targetImage_Sizer = new HorizontalSizer;
    this.targetImage_Sizer.spacing = 4;
    this.targetImage_Sizer.add(this.targetImage_Label);
    this.targetImage_Sizer.add(this.targetImage_ViewList, 100);


    //-------------------------------------------------------
    // Linear Fit Method Field
    //-------------------------------------------------------
    this.algorithm_Label = new Label(this);
    this.algorithm_Label.text = "LinearFit:";
    this.algorithm_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    this.algorithm_Label.minWidth = labelWidth1;

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

    this.algorithm_Sizer = new HorizontalSizer;
    this.algorithm_Sizer.spacing = 4;
    this.algorithm_Sizer.add(this.algorithm_Label);
    this.algorithm_Sizer.add(this.displayGraphControl);
    this.algorithm_Sizer.addStretch();

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
    // Create the ok/cancel buttons
    //-------------------------------------------------------
    this.ok_Button = new PushButton(this);
    this.ok_Button.text = "OK";
    this.ok_Button.cursor = new Cursor(StdCursor_Checkmark);
    this.ok_Button.onClick = function () {
        this.dialog.ok();
    };

    this.cancel_Button = new PushButton(this);
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.cursor = new Cursor(StdCursor_Crossmark);
    this.cancel_Button.onClick = function () {
        this.dialog.cancel();
    };

    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.spacing = 6;

    // New Instance button
    this.newInstance_Button = new ToolButton(this);
    this.newInstance_Button.icon = this.scaledResource(":/process-interface/new-instance.png");
    this.newInstance_Button.setScaledFixedSize(24, 24);
    this.newInstance_Button.toolTip = "Save as Process Icon";
    this.newInstance_Button.onMousePress = function () {
        this.hasFocus = true;
        this.pushed = false;
        data.saveParameters();
        this.dialog.newInstance();
    };

    // Help button
    const HELP_MSG =
            "<p>Apply a scale and offset to the target image so that it matches the reference image. The default parameters should work well. " +
            "Adjust the 'Sample Size' if your images are over or under sampled.</p>" +
            "<p>The 'LinearFit Method' is 'Least Squares'.</p>" +
            "<p>The optional graph displays the sample points and the best fit line.</p>" +
            "<p>The optional test mosaic is used to visually judge how well the target image was scaled.</p>" +
            "<p>The 'CCD Linear Range' rejects all sample squares that contain a sample above this level. " +
            "This ensures that only the linear part of the CCD's range is used.</p>" +
            "The 'Reject Brightest' rejects the N brightest samples. These samples are likely to contain " +
            "bright stars. Increase this if the samples diverge from the fitted line at the top left of the graph.</p>" +
            "<p>The images are divided into 'Sample Size' squares; a sample is the average of a square. " +
            "The 'Sample Size' should be bigger than the diameter of bright stars. " +
            "If set too small, differing FWHM between the two images will affect the linear fit.</p>";

    this.browseDocumentationButton = new ToolButton(this);
    this.browseDocumentationButton.icon = ":/process-interface/browse-documentation.png";
    this.browseDocumentationButton.toolTip =
            "<p>Opens a browser to view the script's documentation.</p>";
    this.browseDocumentationButton.onClick = function () {
        if (!Dialog.browseScriptDocumentation(TITLE)) {
            (new MessageBox(
                    HELP_MSG,
                    TITLE + "." + VERSION,
                    StdIcon_Information,
                    StdButton_Ok
                    )).execute();
        }
    };


    this.buttons_Sizer.add(this.newInstance_Button);
    this.buttons_Sizer.add(this.browseDocumentationButton);

    this.resetButton = new ToolButton(this);

    this.resetButton.icon = ":/images/icons/reset.png";
    this.resetButton.toolTip = "<p>Resets the dialog's parameters.";
    this.resetButton.onClick = function () {
        data.resetParameters(this.dialog);
    };

    this.buttons_Sizer.add(this.resetButton);


    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add(this.ok_Button);
    this.buttons_Sizer.add(this.cancel_Button);


    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(this.helpLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(this.referenceImage_Sizer);
    this.sizer.add(this.targetImage_Sizer);
    this.sizer.add(this.algorithm_Sizer);
    this.sizer.add(this.rejectHigh_Control);
    this.sizer.add(this.buttons_Sizer);

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
        console.writeln("<b>CFA Linear Fit ", VERSION, "</b>:");

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
        console.hide();

        // Quit after successful execution.
        // break;
    }

    return;
}

main();
