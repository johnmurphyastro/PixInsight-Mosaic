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

#include <pjsr/UndoFlag.jsh>

#include "lib/DialogLib.js"

#define VERSION  "1.0"
#define TITLE "CFA Flat colour correction"

/**
 * Stores mean and maximum values
 * @param {Number} mean
 * @param {Number} maxValue
 */
function MeanMaxPair(mean, maxValue) {
    this.mean = mean;
    this.max = maxValue;
}

/**
 * Find the mean value for the specified bayer pixel
 * @param {Image} image Master flat CFA
 * @param {Number} xOffset Specifies the bayer pixel. Valid values 0 or 1
 * @param {Number} yOffset Specifies the bayer pixel. Valid values 0 or 1
 * @returns {MeanMaxPair} Average value for specified bayer pixel and max value
 */
function calcMean(image, xOffset, yOffset){
    let count = 0;
    let total = 0;
    let max = 0;
    for (let x = xOffset; x < image.width; x+=2){
        for (let y = yOffset; y < image.height; y+=2){
            let value = image.sample(x, y);
            total += value;
            max = Math.max(max, value);
            count++;
        }
    }
    return new MeanMaxPair(total / count, max);
}

/**
 * Apply a factor to one of the four bayer pixels
 * @param {type} image Master flat CFA
 * @param {type} xOffset Specifies the bayer pixels. Valid values 0 or 1
 * @param {type} yOffset Specifies the bayer pixels. Valid values 0 or 1
 * @param {type} scale Multiply bayer pixels by this factor
 */
function applyColorBalance(image, xOffset, yOffset, scale){
    for (let x = xOffset; x < image.width; x+=2){
      for (let y = yOffset; y < image.height; y+=2){
         let value = image.sample(x, y) * scale;
         image.setSample(value, x, y);
      }
   }
}

/**
 * Calculates scale factor that neutralises colour in flat and applies the 
 * corrective colour white balance. This must be done for all 4 bayer pixels.
 * @param {Number} targetMean Average pixel value in input image (all pixels)
 * @param {Number} mean Average pixel value in input image (one bayer pixel)
 * @param {Number} whiteBalance Camera white balance factor
 * @returns {Number} Multiply pixels by this value (one bayer pixel)
 */
function calcScale(targetMean, mean, whiteBalance){
    return targetMean / (mean * whiteBalance) ;
}

/**
 * Controller. Processing starts here!
 * @param {CfaLinearFitData} data Values from user interface
 */
function applyWhiteBalance(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let image = targetView.image;
    
    if (targetView.image.isColor) {
        new MessageBox("Error: target image must be CFA", TITLE, StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    console.writeln("\nMaster flat CFA target: ", targetView.fullId);
    console.writeln("White balance: ", 
        data.pixelMult0, ", ", data.pixelMult1, ", ", data.pixelMult2, ", ", data.pixelMult3);
    
    // Determine the difference in average value for each of the four bayer pixels on the Master Flat CFA
    let meanMax0_0 = calcMean(image, 0, 0);
    let meanMax0_1 = calcMean(image, 0, 1);
    let meanMax1_0 = calcMean(image, 1, 0);
    let meanMax1_1 = calcMean(image, 1, 1);
    console.writeln("Removing colour cast from flat: ",
        meanMax0_0.mean, ", ", meanMax0_1.mean, ", ", meanMax1_0.mean, ", ", meanMax1_1.mean);
        
    // Calculate the combined colour cast and white balance correction
    let targetMean = (meanMax0_0.mean + meanMax0_1.mean + meanMax1_0.mean + meanMax1_1.mean) / 4;
    let scale0_0 = calcScale(targetMean, meanMax0_0.mean, data.pixelMult0);
    let scale0_1 = calcScale(targetMean, meanMax0_1.mean, data.pixelMult1);
    let scale1_0 = calcScale(targetMean, meanMax1_0.mean, data.pixelMult2);
    let scale1_1 = calcScale(targetMean, meanMax1_1.mean, data.pixelMult3);
    Console.writeln("Scale factors ",
        scale0_0, ", ", scale0_1, ", ", scale1_0, ", ", scale1_1); 
    
    // Ensure scaled flat pixel values do not exceed 1.0
    let max0_0 = meanMax0_0.max * scale0_0;
    let max0_1 = meanMax0_1.max * scale0_1;
    let max1_0 = meanMax1_0.max * scale1_0;
    let max1_1 = meanMax1_1.max * scale1_1;
    let resultMax = Math.max(max0_0, max0_1, max1_0, max1_1);
    if (resultMax > 1){
        Console.writeln("Warning, max value ", resultMax, " is bigger than 1. Rescaling");
        scale0_0 /= resultMax;
        scale0_1 /= resultMax;
        scale1_0 /= resultMax;
        scale1_1 /= resultMax;
    }
    
    // Apply the correction to the Master Flat CFA
    targetView.beginProcess();
    applyColorBalance(image, 0, 0, scale0_0);
    applyColorBalance(image, 0, 1, scale0_1);
    applyColorBalance(image, 1, 0, scale1_0);
    applyColorBalance(image, 1, 1, scale1_1);
    // Send our parameters to PixInsight core so that it can be added to the history event
    data.saveParameters();
    targetView.endProcess();

    console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

/**
 * Default the Target view to the open view named "Flat".
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view)
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultTargetView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let targetView = null;
    for (let win of allWindows) {
        if (win.currentView.fullId.toLowerCase().contains("flat")){
            targetView = win.currentView;
            break;
        }
    }
    if (null === targetView) {
        targetView = activeWindow.currentView;
    }
    return targetView;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function CfaLinearFitData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
        Parameters.set("pixelMult0", this.pixelMult0);
        Parameters.set("pixelMult1", this.pixelMult1);
        Parameters.set("pixelMult2", this.pixelMult2);
        Parameters.set("pixelMult3", this.pixelMult3);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("pixelMult0"))
            this.pixelMult0 = Parameters.getReal("pixelMult0");
        if (Parameters.has("pixelMult1"))
            this.pixelMult1 = Parameters.getReal("pixelMult1");
        if (Parameters.has("pixelMult2"))
            this.pixelMult2 = Parameters.getReal("pixelMult2");
        if (Parameters.has("pixelMult3"))
            this.pixelMult3 = Parameters.getReal("pixelMult3");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.pixelMult0 = 1.0;
        this.pixelMult1 = 1.689453;
        this.pixelMult2 = 2.202148;
        this.pixelMult3 = 1.0;
    };

    // Used when the user presses the reset button
    this.resetParameters = function (CfaLinearFitDialog) {
        this.setParameters();
        CfaLinearFitDialog.pixelMult0Control.setValue(this.pixelMult0);
        CfaLinearFitDialog.pixelMult1Control.setValue(this.pixelMult1);
        CfaLinearFitDialog.pixelMult2Control.setValue(this.pixelMult2);
        CfaLinearFitDialog.pixelMult3Control.setValue(this.pixelMult3);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.targetView = getDefaultTargetView(activeWindow);
    
    // Initialise the script's data
    this.setParameters();
}

/**
 * 
 * @param {String} label Bayer position (TopLeft, TopRight, BottomRight, BottomLeft)
 * @param {Number} initialValue
 * @param {Number} labelWidth
 * @param {Number} editWidth
 * @returns {NumericEdit} The pixel multiplier control
 */
function createPixelMultControl(label, initialValue, labelWidth, editWidth){
    let pixelMultControl = new NumericEdit();
    pixelMultControl.setReal(true);
    pixelMultControl.setPrecision(6);
    pixelMultControl.setRange(0, 10);
    pixelMultControl.setValue(initialValue);
    pixelMultControl.enableFixedPrecision(true);
    pixelMultControl.label.text = "CFA Pixel " + label + ":";
    pixelMultControl.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    pixelMultControl.label.setFixedWidth(labelWidth);
    pixelMultControl.edit.setFixedWidth(editWidth);
    pixelMultControl.toolTip = "<p>CFA pixel " + label + " multiplication factor.</p>";
    return pixelMultControl;
}

/**
 * 
 * @param {NumericEdit} pixelMultControl
 * @returns {HorizontalSizer}
 */
function createPixelMultRowSizer(pixelMultControl){
    let pixelMultRowSizer = new HorizontalSizer;
    pixelMultRowSizer.add(pixelMultControl);
    pixelMultRowSizer.addStretch();
    return pixelMultRowSizer;
}

// The main dialog function
function CfaLinearFitDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Set some basic widths from dialog text
    let labelWidth1 = this.font.width("CFA Pixel Bottom Right:_");
    let editWidth1 = this.font.width( "000.000000000000" );

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE + " v" + VERSION + "</b> &mdash; Applies camera colour balance to CFA flat.");

    //-------------------------------------------------------
    // Create the target image field
    //-------------------------------------------------------
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Master Flat:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select the RAW CFA flat</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    //-------------------------------------------------------
    // CFA Pixel white balance multipliers
    //-------------------------------------------------------
    this.pixelMult0Control = createPixelMultControl("TopLeft", data.pixelMult0, labelWidth1, editWidth1);
    this.pixelMult0Control.onValueUpdated = function(value){data.pixelMult0 = value;};
    
    this.pixelMult1Control = createPixelMultControl("TopRight", data.pixelMult1, labelWidth1, editWidth1);
    this.pixelMult1Control.onValueUpdated = function(value){data.pixelMult1 = value;};
    
    this.pixelMult2Control = createPixelMultControl("BottomLeft", data.pixelMult2, labelWidth1, editWidth1);
    this.pixelMult2Control.onValueUpdated = function(value){data.pixelMult2 = value;};
    
    this.pixelMult3Control = createPixelMultControl("BottomRight", data.pixelMult3, labelWidth1, editWidth1);
    this.pixelMult3Control.onValueUpdated = function(value){data.pixelMult3 = value;};
    
    // Arranged to match order output by Dcraw.exe
    let pixelMultRow1Sizer = createPixelMultRowSizer(this.pixelMult0Control); // Top Left
    let pixelMultRow2Sizer = createPixelMultRowSizer(this.pixelMult1Control); // Top Right
    let pixelMultRow3Sizer = createPixelMultRowSizer(this.pixelMult3Control); // Bottom Right
    let pixelMultRow4Sizer = createPixelMultRowSizer(this.pixelMult2Control); // Bottom Left
    

    const helpWindowTitle = TITLE + " v" + VERSION;
    const helpMsg =
            "<p>DSLR cameras are calibrated for accurate color balance. " +
            "This script uses the DSLR white balance factors to produce excellent " +
            "colour accuracy by modifying the MasterFlat CFA. To obtain the white balance factors, " +
            "use Dcraw.exe on an image taken with daylight (Sun) white balance.</p>" +
            "<p>https://www.fastpictureviewer.com/downloads/#links</p>" +
            "<p>.\dcraw64.exe -v -w \"D:\IMG_7000.CR2\" </p>" +
            "<p>This outputs 'multipliers 2.202148 1.000000 1.689453 1.000000'</p>" +
            "<p>corresponding to TopLeft, TopRight, BottomRight, BottomLeft</p>" +
            "<p>For cameras (EOS 1D Mk4, EOS 5D Mk2, EOS 7D, EOS 60D, EOS 550D, EOS 600D, EOS 1200D) " +
            "PixInsight no longer reads the top line of the image. This changes the bayer pattern from RGGB to GBRG " +
            "and changes the order of the multipliers; e.g. 1.000000 1.689453 1.000000 2.202148 </p>"
    ;
    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, helpMsg);


    // Vertically stack all the objects
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(titleLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(pixelMultRow1Sizer);
    this.sizer.add(pixelMultRow2Sizer);
    this.sizer.add(pixelMultRow3Sizer);
    this.sizer.add(pixelMultRow4Sizer);
    
    this.sizer.add(buttons_Sizer);

    // Set all the window data
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
CfaLinearFitDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {
//    testLeastSquareFitAlgorithm();

    if (ImageWindow.openWindows.length < 1) {
        (new MessageBox("ERROR: there must be at least one image open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new CfaLinearFitData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new CfaLinearFitDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>", TITLE, " ", VERSION, "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.isColor) {
            (new MessageBox("ERROR: Master flat must be a CFA", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Apply camera white balance to flat CFA
        applyWhiteBalance(data);
        console.hide();

        // Quit after successful execution.
        break;
    }

    return;
}

main();
