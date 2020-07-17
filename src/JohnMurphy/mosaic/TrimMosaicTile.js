/* global UndoFlag_All, Parameters, View, ImageWindow, Dialog, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok, UndoFlag_Keywords, UndoFlag_PixelData, CoreApplication */

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
#feature-id Mosaic > TrimMosaicTile

#feature-info Erodes the non zero area of an image to remove rough edges.<br/>\
Copyright &copy; 2019-2020 John Murphy.<br/>

#include <pjsr/UndoFlag.jsh>
//#include <pjsr/DataType.jsh>
#include "lib/DialogLib.js"
#include "lib/FitsHeader.js"
#include "lib/Geometry.js"

function VERSION(){return "1.1";}
function TITLE(){return "Trim Mosaic Tile";}
function DEFAULT_TRIM(){return 3;}

/**
 * @param {Image} image
 * @param {Number} x x-coordinate
 * @param {Number} y y-coordinate
 * @return {Boolean} true if the specified pixel has a non zero value in one or more channels
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
 * @param {Number} x x-coordinate
 * @param {Number} y y-coordinate
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
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} row Y coordinate
 * @param {Number} nPixels Number of pixels to trim
 * @return {Boolean} true if the row has image content
 */
function trimRowLeft(image, boundingBox, row, nPixels) {
    const minX = boundingBox.x0;
    const maxX = boundingBox.x1;
    for (let x = minX; x < maxX; x++) {
        if (isNotBlack(image, x, row)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let xCoord = x + trim;
                if (xCoord < maxX) {
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
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} row Y coordinate
 * @param {Number} nPixels Number of pixels to trim
 * @return {Boolean} true if the row has image content
 */
function trimRowRight(image, boundingBox, row, nPixels) {
    const minX = boundingBox.x0;
    const maxX = boundingBox.x1;
    for (let x = maxX - 1; x >= minX; x--) {
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
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} col X coordinate
 * @param {Number} nPixels Number of pixels to trim
 * @return {Boolean} true if the col has image content
 */
function trimColumnTop(image, boundingBox, col, nPixels) {
    const minY = boundingBox.y0;
    const maxY = boundingBox.y1;
    for (let y = minY; y < maxY; y++) {
        if (isNotBlack(image, col, y)) {
            for (let trim = 0; trim < nPixels; trim++) {
                let yCoord = y + trim;
                if (yCoord < maxY) {
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
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} col X coordinate
 * @param {Number} nPixels Number of pixels to trim
 * @return {Boolean} true if the column has image content
 */
function trimColumnBottom(image, boundingBox, col, nPixels) {
    const minY = boundingBox.y0;
    const maxY = boundingBox.y1;
    for (let y = maxY - 1; y >= minY; y--) {
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
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} nLeft Number of pixels to remove from left of non zero part of image
 * @param {Number} nRight Number of pixels to remove from right of non zero part of image
 */
function trimRows(image, boundingBox, nLeft, nRight) {
    if (nLeft === 0 && nRight === 0) {
        return; // nothing to trim
    }
    const minRow = boundingBox.y0;
    const maxRow = boundingBox.y1;
    for (let row = minRow; row < maxRow; row++) {
        let rowHasContent = true;
        if (nLeft > 0) {
            rowHasContent = trimRowLeft(image, boundingBox, row, nLeft);
        }
        if (rowHasContent && nRight > 0) {
            trimRowRight(image, boundingBox, row, nRight);
        }
    }
}

/**
 * @param {Image} image
 * @param {Rect} boundingBox Bounding box of non zero pixels 
 * @param {Number} nTop Number of pixels to remove from top of non zero part of image
 * @param {Number} nBottom Number of pixels to remove from bottom of non zero part of image
 */
function trimColumns(image, boundingBox, nTop, nBottom) {
    if (nTop === 0 && nBottom === 0) {
        return; // nothing to trim
    }
    const minCol = boundingBox.x0;
    const maxCol = boundingBox.x1;
    for (let column = minCol; column < maxCol; column++) {
        let colHasContent = true;
        if (nTop > 0) {
            colHasContent = trimColumnTop(image, boundingBox, column, nTop);
        }
        if (colHasContent && nBottom > 0) {
            trimColumnBottom(image, boundingBox, column, nBottom);
        }
    }
}

/**
 * Controller. Processing starts here!
 * @param {TrimImageData} data Values from user interface
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
    let boundingBox = getBoundingBox(image);
    
    // Begin process to let PixInsight know the script is about to modify image data.
    // It will then allow us write access
    targetView.beginProcess(UndoFlag_PixelData | UndoFlag_Keywords);
    trimRows(image, boundingBox, data.left, data.right);
    trimColumns(image, boundingBox, data.top, data.bottom);

    let keywords = targetView.window.keywords;
    keywords.push(new FITSKeyword("HISTORY", "", "TrimMosaicTile.target: " + targetView.fullId));
    keywords.push(new FITSKeyword("HISTORY", "", "TrimMosaicTile.top: " + data.top));
    keywords.push(new FITSKeyword("HISTORY", "", "TrimMosaicTile.bottom: " + data.bottom));
    keywords.push(new FITSKeyword("HISTORY", "", "TrimMosaicTile.left: " + data.left));
    keywords.push(new FITSKeyword("HISTORY", "", "TrimMosaicTile.right: " + data.right));
    targetView.window.keywords = keywords;
    
    // Send our parameters to PixInsight core so that it can be added to the history event
    data.saveParameters();  
    targetView.endProcess();
    
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function TrimImageData() {

    // Used to populate the contents of a saved process icon
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
            this.targetView = View.viewById(viewId);
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.left = DEFAULT_TRIM();
        this.right = DEFAULT_TRIM();
        this.top = DEFAULT_TRIM();
        this.bottom = DEFAULT_TRIM();
    };

    // Used when the user presses the reset button
    this.resetParameters = function (dialog) {
        this.setParameters();
        dialog.left_Control.setValue(this.left);
        dialog.right_Control.setValue(this.right);
        dialog.top_Control.setValue(this.top);
        dialog.bottom_Control.setValue(this.bottom);
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

    // Create the Program Description at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() + 
            "</b> &mdash; Erodes the non zero area of an image to remove rough edges.<br />" +
            "Copyright &copy; 2019-2020 John Murphy.");

    // Create the target image field
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target view:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 460;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Erode the non zero area of this image</p>";
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

    const helpWindowTitle = TITLE() + " v" + VERSION();
    const HELP_MSG =
            "<p>To install this script, use 'SCRIPT \> Feature Scripts...' and then in the " +
            "'Feature Scripts' dialog box, press the 'Add' button and select the folder " +
            "where you unzipped this script.</p>" +
            "<p>To install the help files, unzip 'PhotometricMosaicHelp.zip' to " +
            "'[PixInsight]/doc/scripts/'</p>" +
            "<p>For example, on Windows, the correct installation would include:</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/TrimMosaicTile/TrimMosaicTile.html</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/TrimMosaicTile/images/</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data,
            helpWindowTitle, HELP_MSG, "TrimMosaicTile");

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
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
trimImageDialog.prototype = new Dialog;

// Trim Image main process
function main() {
    const MAJOR = 1;
    const MINOR = 8;
    const RELEASE = 8;
    const REVISION = 5;
    if (!isVersionOk(MAJOR, MINOR, RELEASE, REVISION)){
        displayVersionWarning(MAJOR, MINOR, RELEASE, REVISION);
    }
    
    if (ImageWindow.openWindows.length < 1) {
        (new MessageBox("ERROR: there must be at least one image open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
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
        console.show();
        console.writeln("\n<b>", TITLE()," ", VERSION(), "</b>:");

        // User must select a target view
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Trim the image.
        trimImage(data);
        console.hide();
        // Quit after successful execution.
        // break;
    }

    return;
}

main();
