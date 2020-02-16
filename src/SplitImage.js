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

#include "lib/DialogLib.js"
#include "lib/LinearFitLib.js"

#define VERSION  "1.0"
#define TITLE "Split"
#define HORIZONTAL 0
#define VERTICAL 1

/**
 * Controller. Processing starts here!
 * @param {SplitData} data Values from user interface
 */
function gradientLinearFit(data)
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

    applyGradient(targetView, data.coordinate, data.overlap, isHorizontal);
    data.saveParameters();
    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * Subtract the detected gradient from the target view
 * @param {View} targetView Apply the gradient correction to this view
 * @param {LinearFit[]} line Gradient linear fit line y = mx + b, for each channel
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @returns {undefined}
 */
function applyGradient(targetView, coord, overlap, isHorizontal) {
    let expression1;
    let expression2;
    let imageId1;
    let imageId2;

    if (isHorizontal){
        // left and right
        imageId1 = "left";
        expression1 = "iif(x() < coord + overlap, $T, 0)";
        imageId2 = "right";
        expression2 = "iif(x() > coord - overlap, $T, 0)";
    } else {
        // top and bottom
        imageId1 = "top";
        expression1 = "iif(y() < coord + overlap, $T, 0)";
        imageId2 = "bottom";
        expression2 = "iif(y() > coord - overlap, $T, 0)";
    }

    let P = new PixelMath;
    P.expression = expression1;
    P.useSingleExpression = true;
    P.symbols = "coord = " + coord + ", overlap = " + overlap;
    P.generateOutput = true;
    P.singleThreaded = false;
    P.use64BitWorkingImage = false;
    P.rescale = false;
    P.truncate = false;
    P.createNewImage = true;
    P.showNewImage = true;
    P.newImageId = imageId1;
    P.newImageWidth = 0;
    P.newImageHeight = 0;
    P.newImageAlpha = false;
    P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
    P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
    P.executeOn(targetView, true);

    P.expression = expression2;
    P.newImageId = imageId2;
    P.newImageWidth = 0;
    P.newImageHeight = 0;
    P.newImageAlpha = false;
    P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
    P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
    P.executeOn(targetView, true);
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
        this.overlap = 1;
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
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION + "</b> &mdash; Splits image into two.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Reference View:";
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
    this.orientationCombo.toolTip = "<p>Vertical to split into top and bottom. Horizontal to split into left and right</p>";
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
    this.coordinate_Control.real = true;
    this.coordinate_Control.label.text = "Split Coordinate:";
    this.coordinate_Control.label.minWidth = labelWidth1;
    this.coordinate_Control.toolTip = "<p>Split the image at this x (Horizontal split) or y (Vertical split) coordinate.</p>";
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
    this.coordinate_Control.setPrecision(0);
    this.coordinate_Control.slider.minWidth = 500;
    this.coordinate_Control.setValue(data.coordinate);

    //-------------------------------------------------------
    // Overlap
    //-------------------------------------------------------
    this.overlap_Control = new NumericControl(this);
    this.overlap_Control.real = true;
    this.overlap_Control.label.text = "Overlap:";
    this.overlap_Control.label.minWidth = labelWidth1;
    this.overlap_Control.toolTip = "<p>Amount of overlap between the two new images.</p>";
    this.overlap_Control.onValueUpdated = function (value) {
        data.overlap = value;
    };
    this.overlap_Control.setRange(1, 50);
    this.overlap_Control.slider.setRange(1, 50);
    this.overlap_Control.setPrecision(0);
    this.overlap_Control.slider.minWidth = 500;
    this.overlap_Control.setValue(data.overlap);


    const helpWindowTitle = TITLE + "." + VERSION;
    const HELP_MSG =
            "<p>Split the image at the specified x (Horizontal split) or y (Vertical split) coordinate. " +
            "Two new images are created. Each image contains image data one side of the split, " +
            "plus the overlap region. The other side of the overlap region is set to black (0)</p>";

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
        console.writeln("<b>Split ", VERSION, "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
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
