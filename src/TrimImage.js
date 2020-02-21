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
#feature-id Utilities > trimImage

#feature-info Linear fits target and reference images over the overlaping area.<br/>\
Copyright & copy; 2019 John Murphy.GNU General Public License.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogLib.js"

#define VERSION "1.0"
#define TITLE "Trim Image"
#define DEFAULT_TRIM 3;

/**
 * @param {Image} image
 * @param {number} x x-coordinate
 * @param {number} y y-coordinate
 * @return true if the specified pixel has a non zero value in one or more channels
 */
function isNotBlack(image, x, y) {
    if (image.isColor) {
        return (image.sample(x, y, 0) !== 0) || (image.sample(x, y, 1) !== 0) || (image.sample(x, y, 2) !== 0);
    }
    return image.sample(x, y, 0) !== 0;
}

/**
 * Set the specified pixel to zero
 * @param {Image} image
 * @param {number} x x-coordinate
 * @param {number} y y-coordinate
 */
function setBlack(image, x, y) {
    image.setSample(0, x, y, 0);
    if (image.isColor) {
        image.setSample(0, x, y, 1);
        image.setSample(0, x, y, 2);
    }
}

/** Private function
 * @param {Image} image
 * @param {number} row Y coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the row has image content
 */
function trimRowLeft(image, row, nPixels) {
    let w = image.width;
    for (let x = 0; x < w; x++) {
        if (isNotBlack(image, x, row)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let xCoord = x + trim;
                if (xCoord < w) {
                    setBlack(image, xCoord, row);
                } else {
                    break;
                }
            }
            return true;
        }
    }
    return false; // empty row
}

/** Private function
 * @param {Image} image
 * @param {number} row Y coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the row has image content
 */
function trimRowRight(image, row, nPixels) {
    let w = image.width;
    for (let x = w - 1; x > -1; x--) {
        if (isNotBlack(image, x, row)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let xCoord = x - trim;
                if (xCoord > -1) {
                    setBlack(image, xCoord, row);
                } else {
                    break;
                }
            }
            return true;
        }
    }
    return false; // empty row
}

/** Private function
 * @param {Image} image
 * @param {number} col X coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the col has image content
 */
function trimColumnTop(image, col, nPixels) {
    let h = image.height;
    for (let y = 0; y < h; y++) {
        if (isNotBlack(image, col, y)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let yCoord = y + trim;
                if (yCoord < h) {
                    setBlack(image, col, yCoord);
                } else {
                    break;
                }
            }
            return true;
        }
    }
    return false; // empty col
}

/** Private function
 * @param {Image} image
 * @param {number} col X coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the column has image content
 */
function trimColumnBottom(image, col, nPixels) {
    let h = image.height;
    for (let y = h - 1; y > -1; y--) {
        if (isNotBlack(image, col, y)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let yCoord = y - trim;
                if (yCoord > -1) {
                    setBlack(image, col, yCoord);
                } else {
                    break;
                }
            }
            return true;
        }
    }
    return false; // empty col
}

/**
 * @param {Image} image
 * @param {number} nLeft Number of pixels to remove from left of non zero part of image
 * @param {number} nRight Number of pixels to remove from right of non zero part of image
 */
function trimRows(image, nLeft, nRight) {
    if (nLeft === 0 && nRight === 0) {
        return; // nothing to trim
    }
    let h = image.height;
    for (let row = 0; row < h; row++) {
        let rowHasContent = true;
        if (nLeft > 0) {
            rowHasContent = trimRowLeft(image, row, nLeft);
        }
        if (rowHasContent && nRight > 0) {
            trimRowRight(image, row, nRight);
        }
    }
}

/**
 * @param {Image} image
 * @param {number} nTop Number of pixels to remove from top of non zero part of image
 * @param {number} nBottom Number of pixels to remove from bottom of non zero part of image
 */
function trimColumns(image, nTop, nBottom) {
    if (nTop === 0 && nBottom === 0) {
        return; // nothing to trim
    }
    let w = image.width;
    for (let column = 0; column < w; column++) {
        let colHasContent = true;
        if (nTop > 0) {
            colHasContent = trimColumnTop(image, column, nTop);
        }
        if (colHasContent && nBottom > 0) {
            trimColumnBottom(image, column, nBottom);
        }
    }
}

/**
 * Controller. Processing starts here!
 * @param {trimImageData} data Values from user interface
 */
function trimImage(data)
{
    let startTime = new Date().getTime();

    // Grab the view data from the form
    let targetView = data.targetView;

    console.writeln("Target: ", targetView.fullId,
            ", Top: ", data.top,
            ", Bottom: ", data.bottom,
            ", Left: ", data.left,
            ", Right: ", data.right);

    let image = targetView.image;

    // Begin process to let PixInsight know the script is about to modify image data.
    // It will then allow us write access
    targetView.beginProcess();
    trimRows(image, data.left, data.right);
    trimColumns(image, data.top, data.bottom);
    // Send our parameters to PixInsight core so that it can be added to the history event
    data.saveParameters();
    targetView.endProcess();

    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function TrimImageData() {

    // Used to poplulate the contents of a saved process icon
    this.saveParameters = function () {
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
        Parameters.set("left", this.left);
        Parameters.set("right", this.right);
        Parameters.set("top", this.top);
        Parameters.set("bottom", this.bottom);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("left"))
            this.left = Parameters.getInteger("left");
        if (Parameters.has("right"))
            this.right = Parameters.getReal("right");
        if (Parameters.has("top"))
            this.top = Parameters.getInteger("top");
        if (Parameters.has("bottom"))
            this.bottom = Parameters.getInteger("bottom");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.left = DEFAULT_TRIM;
        this.right = DEFAULT_TRIM;
        this.top = DEFAULT_TRIM;
        this.bottom = DEFAULT_TRIM;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.left_Control.setValue(this.left);
        linearFitDialog.right_Control.setValue(this.right);
        linearFitDialog.top_Control.setValue(this.top);
        linearFitDialog.bottom_Control.setValue(this.bottom);
    };

    // Initialise the script's data
    let activeWindow = ImageWindow.activeWindow;
    if (!activeWindow.isNull) {
        this.targetView = activeWindow.currentView;
    }
    this.setParameters();
}

/**
 * Trim Control
 * @param {String} label    trim label (e.g. 'Left:')
 * @param {Number} labelWidth
 * @param {String} tooltip
 * @param {Number} value    initial value
 * @returns {NumericControl}
 */
function createTrimControl(label, labelWidth, tooltip, value) {
    let control = new NumericControl(this);
    control.real = false;
    control.label.text = label;
    control.label.minWidth = labelWidth;
    control.toolTip = tooltip;
    control.setRange(0, 50);
    control.slider.setRange(0, 50);
    control.slider.minWidth = 200;
    control.setValue(value);
    return control;
}

// The main dialog function
function trimImageDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Set some basic widths from dialog text
    let labelWidth1 = this.font.width("Bottom:_");

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION + "</b> &mdash; Trim the edge of the none zero area.");

    // Create the target image field
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
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    // Trim left
    this.left_Control = createTrimControl("Left:", labelWidth1, "<p>Trim pixels on left of non zero area.</p>", data.left);
    this.left_Control.onValueUpdated = function (value) {
        data.left = value;
    };

    // Trim right
    this.right_Control = createTrimControl("Right:", labelWidth1, "<p>Trim pixels on right of non zero area.</p>", data.right);
    this.right_Control.onValueUpdated = function (value) {
        data.right = value;
    };

    // Trim top
    this.top_Control = createTrimControl("Top:", labelWidth1, "<p>Trim pixels on top of non zero area.</p>", data.top);
    this.top_Control.onValueUpdated = function (value) {
        data.top = value;
    };

    // Trim bottom
    this.bottom_Control = createTrimControl("Bottom:", labelWidth1, "<p>Trim pixels on bottom of non zero area.</p>", data.bottom);
    this.bottom_Control.onValueUpdated = function (value) {
        data.bottom = value;
    };

    const helpWindowTitle = TITLE + " v" + VERSION;
    const helpMsg = "<p>Trim the pixels at the edge of the non zero part of an image. " +
            "Black pixels are ignored. Modified pixels are set to black.</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, helpMsg);

    // Vertically stack all the objects
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(titleLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(this.top_Control);
    this.sizer.add(this.bottom_Control);
    this.sizer.add(this.left_Control);
    this.sizer.add(this.right_Control);
    this.sizer.add(buttons_Sizer);

    // Set all the window data
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
trimImageDialog.prototype = new Dialog;

// Trim Image main process
function main() {
    //console.hide();

    if (ImageWindow.openWindows.length < 1) {
        (new MessageBox("ERROR: there must be at least one image open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new TrimImageData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let trimDialog = new trimImageDialog(data);
    for (; ; ) {
        if (!trimDialog.execute())
            break;

        console.writeln("\n<b>Trim Image ", VERSION, "</b>:");

        // User must select a target view
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Call the layer extraction routine.
        trimImage(data);

        // Quit after successful execution.
        break;
    }

    return;
}

main();
