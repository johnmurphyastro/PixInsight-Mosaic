/* global HORIZONTAL, TITLE, ImageWindow, UndoFlag_NoSwapFile, Parameters, View, VERTICAL, Dialog, VERSION, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok */

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
#feature-id Mosaic > SplitMosaicTile

#feature-info Splits an image into two overlapping images.<br/>\
Copyright &copy; 2019-2020 John Murphy.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogLib.js"

#define VERSION  "1.0"
#define TITLE "SplitMosaicTile"
#define HORIZONTAL 0
#define VERTICAL 1

/**
 * Controller. Processing starts here!
 * @param {SplitData} data Values from user interface
 */
function splitImage(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    console.writeln("Target: ", targetView.fullId);
    let isHorizontal;
    if (data.orientation === HORIZONTAL){
        console.writeln("<b>Mode: Horizontal Split</b>");
        isHorizontal = true;
    } else {
        console.writeln("<b>Mode: Vertical Split</b>");
        isHorizontal = false;
    }

    createSplitImages(targetView, data, isHorizontal);
    
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * Create two overlapping images from the supplied target image
 * @param {View} tgtView Contains the image to be split into two
 * @param {SplitData} data Values from user interface
 * @param {Boolean} isHorizontal True if left / right split
 * @returns {undefined}
 */
function createSplitImages(tgtView, data, isHorizontal) {
    const coord = data.coordinate;
    const overlap = data.overlap;
    const width = tgtView.image.width;
    const height = tgtView.image.height;
    
    // Clone the target view and image
    if (isHorizontal){
        let eraseRect2 = new Rect(0, 0, coord - overlap, height);
        CopyImageEraseArea(tgtView, data, eraseRect2, "_Right");
        let eraseRect1 = new Rect(coord + overlap, 0, width, height);
        CopyImageEraseArea(tgtView, data, eraseRect1, "_Left");
    } else {
        let eraseRect2 = new Rect(0, 0, width, coord - overlap);
        CopyImageEraseArea(tgtView, data, eraseRect2, "_Bottom");
        let eraseRect1 = new Rect(0, coord + overlap, width, height);
        CopyImageEraseArea(tgtView, data, eraseRect1, "_Top");
    }
}

/**
 * Copy the target image, erase specified rectangle, display new window
 * @param {View} tgtView
 * @param {SplitData} data
 * @param {Rect} eraseRect
 * @param {String} titlePostfix
 */
function CopyImageEraseArea(tgtView, data, eraseRect, titlePostfix){
    const width = tgtView.image.width;
    const height = tgtView.image.height;
    const nChannels = tgtView.image.isColor ? 3 : 1;
    let keywords = tgtView.window.keywords;
    let w = tgtView.window;
    let imgWindow = new ImageWindow(width, height, nChannels, w.bitsPerSample, 
            w.isFloatSample, nChannels > 1, tgtView.fullId + titlePostfix);    
    imgWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
    let view = imgWindow.mainView;
    view.image.assign(tgtView.image);
    view.image.fill(0, eraseRect, 0, nChannels - 1);
    view.window.keywords = keywords;
    data.saveParameters(); // History only gets saved to the last view this is called for
    view.endProcess();
    view.stf = tgtView.stf;
    view.window.show();
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function SplitData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
        Parameters.set("orientation", this.orientation);
        Parameters.set("overlap", this.overlap);
        Parameters.set("coordinate", this.coordinate);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("overlap"))
            this.overlap = Parameters.getReal("overlap");
        if (Parameters.has("coordinate"))
            this.coordinate = Parameters.getInteger("coordinate");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.orientation = VERTICAL;
        this.overlap = 50;
        this.coordinate = 500;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (splitDialog) {
        this.setParameters();
        splitDialog.orientationCombo.currentItem = VERTICAL;
        splitDialog.overlap_Control.setValue(this.overlap);
        splitDialog.coordinate_Control.setValue(this.coordinate);
    };

    let activeWindow = ImageWindow.activeWindow;
    if (!activeWindow.isNull) {
        this.targetView = activeWindow.currentView;
    }
    // Initialise the script's data
    this.setParameters();
}

// The main dialog function
function SplitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    //-------------------------------------------------------
    // Set some basic widths from dialog text
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("Split Coordinate:_");

    //-------------------------------------------------------
    // Create the Program Discription at the top
    //-------------------------------------------------------
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION + 
            "</b> &mdash; Splits an image into two overlapping images.<br />" +
            "Copyright &copy; 2019-2020 John Murphy.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target View:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Image to split</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
        if (data.orientation === VERTICAL){
            this.dialog.coordinate_Control.setRange(0, view.image.height);
            this.dialog.coordinate_Control.slider.setRange(0, view.image.height);
        } else {
            this.dialog.coordinate_Control.setRange(0, view.image.width);
            this.dialog.coordinate_Control.slider.setRange(0, view.image.width);
        }
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    //-------------------------------------------------------
    // Linear Fit Method Field
    //-------------------------------------------------------
    let algorithm_Label = new Label(this);
    algorithm_Label.text = "Split Direction:";
    algorithm_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    algorithm_Label.minWidth = labelWidth1;

    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = 
            "<p>Vertical to split into top and bottom. Horizontal to split into left and right</p>";
    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
        if (data.orientation === VERTICAL){
            this.dialog.coordinate_Control.setRange(0, data.targetView.image.height);
            this.dialog.coordinate_Control.slider.setRange(0, data.targetView.image.height);
        } else {
            this.dialog.coordinate_Control.setRange(0, data.targetView.image.width);
            this.dialog.coordinate_Control.slider.setRange(0, data.targetView.image.width);
        }
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(algorithm_Label);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addStretch();

    //-------------------------------------------------------
    // Coordinate
    //-------------------------------------------------------
    this.coordinate_Control = new NumericControl(this);
    this.coordinate_Control.real = false;
    this.coordinate_Control.label.text = "Split Coordinate:";
    this.coordinate_Control.label.minWidth = labelWidth1;
    this.coordinate_Control.toolTip = 
            "<p>Split the image at this x (Horizontal split) or y (Vertical split) coordinate.</p>";
    this.coordinate_Control.onValueUpdated = function (value) {
        data.coordinate = value;
    };
    let maxRange = 10000;
    if (data.targetView !== null){
        if (data.orientation === VERTICAL){
            maxRange = data.targetView.image.height;
        } else {
            maxRange = data.targetView.image.width;
        }
    }
    this.coordinate_Control.setRange(0, maxRange);
    this.coordinate_Control.slider.setRange(0, maxRange);
    this.coordinate_Control.slider.minWidth = 500;
    this.coordinate_Control.setValue(data.coordinate);

    //-------------------------------------------------------
    // Overlap
    //-------------------------------------------------------
    this.overlap_Control = new NumericControl(this);
    this.overlap_Control.real = false;
    this.overlap_Control.label.text = "Overlap:";
    this.overlap_Control.label.minWidth = labelWidth1;
    this.overlap_Control.toolTip = "<p>Amount of overlap between the two new images.</p>" +
            "<p>Each image extends this overlap distance beyond the 'Split Coordinate'.</p>";
    this.overlap_Control.onValueUpdated = function (value) {
        data.overlap = value;
    };
    this.overlap_Control.setRange(1, 400);
    this.overlap_Control.slider.setRange(1, 400);
    this.overlap_Control.slider.minWidth = 400;
    this.overlap_Control.setValue(data.overlap);


    const helpWindowTitle = TITLE + " v" + VERSION;
    const HELP_MSG =
            "<p>Split the image at the specified x (Horizontal split) or y (Vertical split) coordinate. " +
            "Two new images are created. Each image contains image data one side of the split, " +
            "plus the overlap region. The other side of the overlap region is set to black (0)</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, HELP_MSG);

    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(titleLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(orientationSizer);
    this.sizer.add(this.coordinate_Control);
    this.sizer.add(this.overlap_Control);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
SplitDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {

    if (ImageWindow.openWindows.length < 1) {
        (new MessageBox("ERROR: there must be at least one image open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new SplitData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let splitDialog = new SplitDialog(data);
    for (; ; ) {
        if (!splitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>", TITLE, " ", VERSION, "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        splitImage(data);
        console.hide();

        // Quit after successful execution.
        // break;
    }

    return;
}

main();
