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
#feature-id Utilities > Photometric Mosaic

#feature-info Calculates scale and gradient offset between two images over their overlapping area.<br/>\
Copyright & copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogLib.js"
#include "lib/SamplePair.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/StarLib.js"
#include "lib/Gradient.js"
#include "lib/FitsHeader.js"

function VERSION(){return  "1.0";}
function TITLE(){return "Photometric Mosaic";}
function HORIZONTAL(){return 0;}
function VERTICAL(){return 1;}
function AUTO(){return 2;}
function MOSAIC_NAME(){return "Mosaic";}
function WINDOW_ID_PREFIX(){return "PM__";}

/**
 * Controller. Processing starts here!
 * @param {PhotometricMosaicData} data Values from user interface
 */
function PhotometricMosaic(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let referenceView = data.referenceView;
    let nChannels = targetView.image.isColor ? 3 : 1;      // L = 0; R=0, G=1, B=2

    console.writeln("Reference: ", referenceView.fullId, ", Target: ", targetView.fullId);

    let samplePreviewArea = null;
    if (data.hasAreaOfInterest) {
        samplePreviewArea = new Rect(data.areaOfInterest_X0, data.areaOfInterest_Y0, 
                data.areaOfInterest_X1, data.areaOfInterest_Y1);
    }
    let detectStarTime = new Date().getTime();
    let detectedStars = new StarsDetected();
    detectedStars.detectStars(referenceView, targetView, samplePreviewArea, data.logStarDetection);
    if (detectedStars.overlapBox === null){
        let msgEnd = (samplePreviewArea === null) ? "." : " within preview area.";
        let errorMsg = "Error: '" + referenceView.fullId + "' and '" + targetView.fullId + "' do not overlap" + msgEnd;
        new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    if (samplePreviewArea === null){
        samplePreviewArea = detectedStars.overlapBox;
    }
    let colorStarPairs = detectedStars.getColorStarPairs(referenceView.image, targetView.image, data.rejectHigh);
    console.writeln("Detected " + detectedStars.allStars.length + " stars (", getElapsedTime(detectStarTime), ")");
    if (targetView.image.isColor){
        console.writeln("Stars used for photometry: red " + colorStarPairs[0].starPairArray.length + 
                ", green " + colorStarPairs[1].starPairArray.length + 
                ", blue " + colorStarPairs[2].starPairArray.length);
    } else {
        console.writeln("Stars used for photometry: " + colorStarPairs[0].starPairArray.length);
    }
    
    if (data.testMaskOnly){
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, true);
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, false);
        console.writeln("\n" + TITLE() + ":Mask Creation Total time ", getElapsedTime(startTime));
        return;
    }

    // Apply scale to target image. Must be done before calculating the gradient
    let scaleFactor = [];
    for (let c = 0; c < nChannels; c++){
        // For each color
        let starPairs = colorStarPairs[c];
        if (starPairs.starPairArray.length === 0){
            let warning = "Warning: channel [" + c + "] has no matching stars. Defaulting scale to 1.0";
            let messageBox = new MessageBox(warning, "Warning - no matching stars", StdIcon_Warning, StdButton_Ok, StdButton_Abort);
            if (StdButton_Abort === messageBox.execute()){
                console.warningln("No matching stars. Aborting...");
                return;
            }
        }
        starPairs.linearFitData = calculateScale(starPairs);
        for (let i=0; i<data.outlierRemoval; i++){
            starPairs = removeStarPairOutlier(starPairs, starPairs.linearFitData);
            starPairs.linearFitData = calculateScale(starPairs);
        }
        scaleFactor.push(starPairs.linearFitData);
        let text = "Scaling " + targetView.fullId + " channel[" + c + "] x " + 
                starPairs.linearFitData.m.toPrecision(5);
        if (starPairs.starPairArray.length < 4){
            console.warningln(text + " (Warning: calculated from only " + starPairs.starPairArray.length + " stars)");
        } else {
            console.writeln(text);
        }
    }
    targetView.beginProcess();
    applyLinearFitScale(targetView, scaleFactor, false);

    let colorSamplePairs = createColorSamplePairs(targetView.image, referenceView.image,
        data.sampleSize, detectedStars.allStars, data.rejectHigh, data.limitSampleStarsPercent, samplePreviewArea);
    let samplePairs = colorSamplePairs[0];
    if (samplePairs.samplePairArray.length < 2) {
        new MessageBox("Error: Too few samples to determine a linear fit.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }

    let sampleArea = samplePairs.getSampleArea();
    let isHorizontal = isJoinHorizontal(data, sampleArea);

    // Calculate the gradient for each channel
    let gradients = [];
    let nLineSegments = (data.nLineSegments + 1) / 2;
    for (let c = 0; c < nChannels; c++) {
        samplePairs = colorSamplePairs[c];
        gradients[c] = new Gradient(samplePairs, nLineSegments, targetView.image, samplePreviewArea, isHorizontal);
    }

    let applyGradientTime = new Date().getTime();
    applyGradient(targetView, isHorizontal, gradients, detectedStars.overlapBox, 
        data.taperFlag, data.taperLength);
    console.writeln("Applied gradients (", getElapsedTime(applyGradientTime), ")\n");

    // Save parameters to PixInsight history
    data.saveParameters();
    targetView.endProcess();

    if (data.displayStarsFlag) {
        let time = new Date().getTime();
        for (let i = 0; i < colorStarPairs.length; i++) {
            let starPairs = colorStarPairs[i];
            displayDetectedStars(targetView, starPairs.starPairArray, i, referenceView.image.isColor);
        }
        console.writeln("Displaying photometric stars... (", getElapsedTime(time), ")");
    }

    if (data.displaySamplesFlag){
        let time = new Date().getTime();
        let title = WINDOW_ID_PREFIX() + targetView.fullId + "__Samples";
        displaySampleSquares(referenceView, colorSamplePairs[0], detectedStars.allStars, data.limitSampleStarsPercent, title);
        console.writeln("Displaying samples... (", getElapsedTime(time), ")");
    }

    if (data.photometryGraphFlag){
        let time = new Date().getTime();
        displayStarGraph(referenceView, targetView, 730, colorStarPairs);
        console.writeln("Displaying photometry graph... (", getElapsedTime(time), ")");
    }

    if (data.displayGraphFlag) {
        let time = new Date().getTime();
        displayGradientGraph(targetView, referenceView, 1000, isHorizontal, gradients, colorSamplePairs);
        console.writeln("Displaying gradient graph... (", getElapsedTime(time), ")");
    }

    if (data.createMosaicFlag){
        let mosaicName = MOSAIC_NAME();
        let createMosaicView = (referenceView.fullId !== mosaicName);
        
        if (createMosaicView){
            if (!View.viewById(mosaicName).isNull){
                // find a unique name for the new mosaic view
                let mosaicNameBase = mosaicName;
                for (let i=1; ; i++){
                    if (View.viewById(mosaicNameBase + i).isNull){
                        mosaicName = mosaicNameBase + i;
                        break;
                    }
                }
            }
            console.writeln("Creating ", mosaicName);
        } else {
            // The reference view has been set to a previously created mosaic.
            // We will update this view
            console.writeln("Updating ", mosaicName);
        }
        createMosaic(referenceView, targetView, mosaicName, createMosaicView,
                data.mosaicOverlayRefFlag, data.mosaicOverlayTgtFlag, data.mosaicRandomFlag);
                
        if (createMosaicView){
            // Update Fits Header
            let mosaicView = View.viewById(mosaicName);
            mosaicView.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
            addFitsHistory(mosaicView, "PhotometricMosaic " + VERSION());
            copyFitsObservation(referenceView, mosaicView);
            copyFitsAstrometricSolution(referenceView, mosaicView);
            mosaicView.endProcess();
        }
    }
    
    if (data.displayMaskFlag){
        let time = new Date().getTime();
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, true);
        console.writeln("Created mask for ", targetView.fullId, " (", getElapsedTime(time), ")");
    }
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
}

/**
 * @param {StarPairs} starPairs
 * @returns {LinearFitData} Least Square Fit between reference & target star flux
 */
function calculateScale(starPairs) {
    let leastSquareFit = new LeastSquareFitAlgorithm();
    for (let starPair of starPairs.starPairArray) {
        leastSquareFit.addValue(starPair.tgtStar.flux, starPair.refStar.flux);
    }
    return leastSquareFit.getOriginFit();
}

/**
 * Apply the linear fit scale factor (gradient) to all non zero samples within 
 * the target image. The output image is not truncated to be within the 0 to 1
 * range because the offset/gradient will be applied later on.
 * The scale should always be corrected (via photometry) before the offset or 
 * gradient is calculated.
 * @param {View} view Target view
 * @param {LinearFitData[]} linearFitColorArray LinearFitData for each channel
 * @param {Boolean} allowUndo
 * @returns {undefined}
 */
function applyLinearFitScale(view, linearFitColorArray, allowUndo) {
    let P = new PixelMath;
    P.setDescription("Apply gradient to " + view.fullId);
    P.symbols = "m0 = " + linearFitColorArray[0].m;
    P.expression0 = "iif($T == 0, 0, $T * m0)";
    if (3 === linearFitColorArray.length) { // RGB
        P.symbols += ", m1 = " + linearFitColorArray[1].m;
        P.expression1 = "iif($T == 0, 0, $T * m1)";
        P.symbols += ", m2 = " + linearFitColorArray[2].m;
        P.expression2 = "iif($T == 0, 0, $T * m2)";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = false;
    P.createNewImage = false;
    P.executeOn(view, allowUndo);
}

/**
 * Subtract the detected gradient from the target view
 * @param {View} view Apply the gradient correction to this view
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @param {Gradient[]} gradients Gradient for each color channel
 * @param {Rect} overlapBox Bounding box of overlap region
 * @param {Boolean} taperFlag If true, apply taper to average offset in direction perpendicular to join
 * @param {Number} taperLength Length of taper to apply in pixels
 * @returns {undefined}
 */
function applyGradient(view, isHorizontal, gradients, overlapBox, taperFlag, taperLength) {
    let nChannels = gradients.length;
    let targetImage = view.image;
    for (let channel = 0; channel < nChannels; channel++) {
        let gradientData = gradients[channel].getGradientData();
        let difArray = gradientData.difArray;
        let average = Math.mean(difArray);
        console.writeln("Channel[", channel, "] average offset ", average.toPrecision(5));
        let gradientOffset = new GradientOffset(targetImage.width, targetImage.height, 
                average, overlapBox, taperLength, isHorizontal);     
                
        for (let y = 0; y < targetImage.height; y++) {
            for (let x = 0; x < targetImage.width; x++) {
                let sample = targetImage.sample(x, y, channel);
                if (sample !== 0) {
                    let offset;
                    if (isHorizontal){
                        offset = difArray[x];
                        if (taperFlag){
                            offset = gradientOffset.getOffset(y, offset);
                        }
                    } else {
                        offset = difArray[y];
                        if (taperFlag){
                            offset = gradientOffset.getOffset(x, offset);
                        }
                    }
                    view.image.setSample(sample - offset, x, y, channel);
                }
            }
        }
    }
    let minValue = view.image.minimum();
    let maxValue = view.image.maximum();
    if (minValue < 0 || maxValue > 1){
        console.warningln(view.fullId + ": min value = " + minValue + ", max value = " + maxValue + "\nTruncating image...");
        view.image.truncate(0, 1);
    }
}

/**
 * Create or append to a mosaic by adding two images together
 * If the MosaicTest image does not exist it is created.
 * Zero pixels are ignored
 * 
 * @param {View} referenceView In overlay mode, displayed on top
 * @param {View} targetView In overlay mode, displayed beneath
 * @param {String} mosaicImageName
 * @param {Boolean} createMosaicView If true create image, else replace reference view
 * @param {Boolean} overlayRefFlag Set overlapping pixels to the reference image
 * @param {Boolean} overlayTgtFlag Set overlapping pixels to the target image
 * @param {Boolean} randomFlag Set overlapping pixels randomly to reference or target pixels
 * @returns {undefined}
 */
function createMosaic(referenceView, targetView, mosaicImageName, createMosaicView,
        overlayRefFlag, overlayTgtFlag, randomFlag) {
    let P = new PixelMath;
    P.setDescription("Create Mosaic from " + referenceView.fullId + ", " + targetView.fullId);
    let expression;
    if (overlayRefFlag) {
        expression = format("iif(%s != 0, %s, %s)", referenceView.fullId, referenceView.fullId, targetView.fullId);
    } else if (overlayTgtFlag){
        expression = format("iif(%s != 0, %s, %s)", targetView.fullId, targetView.fullId, referenceView.fullId);
    } else if (randomFlag){
        // iif( A && B, rndselect( A, B ), A + B )
        let A = referenceView.fullId;
        let B = targetView.fullId;
        expression = "iif(" + A + " && " + B + ", rndselect(" + A + ", " + B + "), " + A + " + " + B + ")";
    } else {
        // Average: iif( A && B, mean( A, B ), A + B )
        let A = referenceView.fullId;
        let B = targetView.fullId;
        expression = "iif(" + A + " && " + B + ", (" + A + " + " + B + ")/2, " + A + " + " + B + ")";
    }

    P.expression = expression;
    P.symbols = "";
    P.useSingleExpression = true;
    P.generateOutput = true;
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = false; // Both input images should be within range
    if (createMosaicView) {
        P.createNewImage = true;
        P.showNewImage = true;
        P.newImageId = mosaicImageName;
        P.newImageWidth = 0;
        P.newImageHeight = 0;
        P.newImageAlpha = false;
        P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
        P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
        P.executeOn(targetView, true); // used to get sample format and color space
    } else {
        P.createNewImage = false;
        P.executeOn(referenceView, true);
    }
}

/**
 *
 * @param {Data} data
 * @param {Rect} sampleArea
 * @returns {Boolean} True if the mosaic join is mostly horizontal
 */
function isJoinHorizontal(data, sampleArea){
    if (data.orientation === HORIZONTAL()){
        console.writeln("<b>Mode: Horizontal Gradient</b>");
        return true;
    }
    if (data.orientation === VERTICAL()){
        console.writeln("<b>Mode: Vertical Gradient</b>");
        return false;
    }
    let isHorizontal = sampleArea.width > sampleArea.height;
    if (isHorizontal) {
        console.writeln("\n<b>Mode auto selected: Horizontal Gradient</b>");
    } else {
        console.writeln("\n<b>Mode auto selected: Vertical Gradient</b>");
    }
    return isHorizontal;
}

/**
 * Default the Reference view to the open view named "Mosaic".
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view).
 * Avoid all graph / sample windows that start with "PM__"
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultReferenceView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let referenceView = null;
    for (let win of allWindows) {
        if (win.currentView.fullId.startsWith(WINDOW_ID_PREFIX())){
            continue;
        }
        if (win.currentView.fullId.toLowerCase().contains("mosaic")) {
            referenceView = win.currentView;
            break;
        }
    }
    if (null === referenceView) {
        for (let win of allWindows) {
            if (win.currentView.fullId.startsWith(WINDOW_ID_PREFIX())) {
                continue;
            }
            if (activeWindow.currentView.fullId !== win.currentView.fullId) {
                referenceView = win.currentView;
                break;
            }
        }
    }
    return referenceView;
}

/**
 * Default the target view to the current view provided it is not a graph/sample
 * window (starting with "PM__").
 * @param {ImageWindow} activeWindow
 * @param {View} referenceView
 * @returns {win.currentView}
 */
function getDefaultTargetView(activeWindow, referenceView){
    let targetView = null;
    if (!activeWindow.currentView.fullId.startsWith(WINDOW_ID_PREFIX())){
        targetView = activeWindow.currentView;
    } else {
        let allWindows = ImageWindow.openWindows;
        for (let win of allWindows) {
            if (win.currentView.fullId.startsWith(WINDOW_ID_PREFIX())) {
                continue;
            }
            if (referenceView !== win.currentView.fullId) {
                targetView = win.currentView;
                break;
            }
        }
    }
    return targetView;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function PhotometricMosaicData() {
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
        Parameters.set("starDetection", this.logStarDetection);
        Parameters.set("displayStars", this.displayStarsFlag);
        Parameters.set("photometryGraph", this.photometryGraphFlag);
        Parameters.set("orientation", this.orientation);
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("outlierRemoval", this.outlierRemoval);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("nLineSegments", this.nLineSegments);
        Parameters.set("taperFlag", this.taperFlag);
        Parameters.set("taperLength", this.taperLength);
        Parameters.set("displayGraphFlag", this.displayGraphFlag);
        Parameters.set("displaySamplesFlag", this.displaySamplesFlag);
        Parameters.set("createMosaicFlag", this.createMosaicFlag);
        Parameters.set("mosaicOverlayRefFlag", this.mosaicOverlayRefFlag);
        Parameters.set("mosaicOverlayTgtFlag", this.mosaicOverlayTgtFlag);
        Parameters.set("mosaicRandomFlag", this.mosaicRandomFlag);
        Parameters.set("mosaicAverageFlag", this.mosaicAverageFlag);
        Parameters.set("displayMaskFlag", this.displayMaskFlag);
        Parameters.set("testMaskOnly", this.testMaskOnly);
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("multiplyStarRadius", this.radiusMult);
        Parameters.set("addStarRadius", this.radiusAdd);
        
        Parameters.set("hasAreaOfInterest", this.hasAreaOfInterest);
        Parameters.set("areaOfInterest_X0", this.areaOfInterest_X0);
        Parameters.set("areaOfInterest_Y0", this.areaOfInterest_Y0);
        Parameters.set("areaOfInterest_X1", this.areaOfInterest_X1);
        Parameters.set("areaOfInterest_Y1", this.areaOfInterest_Y1);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("starDetection"))
            this.logStarDetection = Parameters.getReal("starDetection");
        if (Parameters.has("displayStars"))
            this.displayStarsFlag = Parameters.getBoolean("displayStars");
        if (Parameters.has("photometryGraph"))
            this.photometryGraphFlag = Parameters.getBoolean("photometryGraph");
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("outlierRemoval"))
            this.outlierRemoval = Parameters.getInteger("outlierRemoval");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("nLineSegments"))
            this.nLineSegments = Parameters.getInteger("nLineSegments");
        if (Parameters.has("taperFlag"))
            this.taperFlag = Parameters.getBoolean("taperFlag");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
        if (Parameters.has("displayGraphFlag"))
            this.displayGraphFlag = Parameters.getBoolean("displayGraphFlag");
        if (Parameters.has("displaySamplesFlag"))
            this.displaySamplesFlag = Parameters.getBoolean("displaySamplesFlag");
        if (Parameters.has("createMosaicFlag"))
            this.createMosaicFlag = Parameters.getBoolean("createMosaicFlag");
        if (Parameters.has("mosaicOverlayRefFlag"))
            this.mosaicOverlayRefFlag = Parameters.getBoolean("mosaicOverlayRefFlag");
        if (Parameters.has("mosaicOverlayTgtFlag"))
            this.mosaicOverlayTgtFlag = Parameters.getBoolean("mosaicOverlayTgtFlag");
        if (Parameters.has("mosaicRandomFlag"))
            this.mosaicRandomFlag = Parameters.getBoolean("mosaicRandomFlag");
        if (Parameters.has("mosaicAverageFlag"))
            this.mosaicAverageFlag = Parameters.getBoolean("mosaicAverageFlag");
        if (Parameters.has("displayMaskFlag"))
            this.displayMaskFlag = Parameters.getBoolean("displayMaskFlag");
        if (Parameters.has("testMaskOnly"))
            this.testMaskOnly = Parameters.getBoolean("testMaskOnly");
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("multiplyStarRadius"))
            this.radiusMult = Parameters.getReal("multiplyStarRadius");
        if (Parameters.has("addStarRadius"))
            this.radiusAdd = Parameters.getReal("addStarRadius");
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
        if (Parameters.has("areaOfInterest_X0")){
            this.areaOfInterest_X0 = Parameters.getInteger("areaOfInterest_X0");
        }
        if (Parameters.has("areaOfInterest_Y0")){
            this.areaOfInterest_Y0 = Parameters.getInteger("areaOfInterest_Y0");
        }
        if (Parameters.has("areaOfInterest_X1")){
            this.areaOfInterest_X1 = Parameters.getInteger("areaOfInterest_X1");
        }
        if (Parameters.has("areaOfInterest_Y1")){
            this.areaOfInterest_Y1 = Parameters.getInteger("areaOfInterest_Y1");
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.logStarDetection = 0;
        this.displayStarsFlag = false;
        this.photometryGraphFlag = true;
        this.orientation = AUTO();
        this.rejectHigh = 0.8;
        this.outlierRemoval = 0;
        this.sampleSize = 20;
        this.limitSampleStarsPercent = 25;
        this.nLineSegments = 1;
        this.taperFlag = false;
        this.taperLength = 1500;
        this.displayGraphFlag = true;
        this.displaySamplesFlag = true;
        this.createMosaicFlag = true;
        this.mosaicOverlayRefFlag = false;
        this.mosaicOverlayTgtFlag = false;
        this.mosaicRandomFlag = true;
        this.mosaicAverageFlag = false;
        this.displayMaskFlag = true;
        this.testMaskOnly = false;
        this.limitMaskStarsPercent = 25;
        this.radiusMult = 2.5;
        this.radiusAdd = -1;

        this.hasAreaOfInterest = false;
        this.areaOfInterest_X0 = 0;
        this.areaOfInterest_Y0 = 0;
        this.areaOfInterest_X1 = 0;
        this.areaOfInterest_Y1 = 0;
        
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.orientationCombo.currentItem = AUTO();
        linearFitDialog.starDetectionControl.setValue(this.logStarDetection);
        linearFitDialog.displayStarsControl.checked = this.displayStarsFlag;
        linearFitDialog.photometryGraphControl.checked = this.photometryGraphFlag;
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.displaySampleControl.checked = this.displaySamplesFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.outlierRemoval_Control.setValue(this.outlierRemoval);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        linearFitDialog.lineSegments_Control.setValue(this.nLineSegments);
        linearFitDialog.taperFlag_Control.checked = this.taperFlag;
        linearFitDialog.taperLength_Control.setValue(this.taperLength);
        linearFitDialog.displayMosaicControl.checked = this.createMosaicFlag;
        linearFitDialog.mosaicOverlayRefControl.checked = this.mosaicOverlayRefFlag;
        linearFitDialog.mosaicOverlayTgtControl.checked = this.mosaicOverlayTgtFlag;
        linearFitDialog.starMaskFlagControl.checked = this.displayMaskFlag;
        linearFitDialog.testMaskFlagControl.checked = this.testMaskOnly;
        linearFitDialog.LimitMaskStars_Control.setValue(this.limitMaskStarsPercent);
        linearFitDialog.StarRadiusMultiply_Control.setValue(this.radiusMult);
        linearFitDialog.StarRadiusAdd_Control.setValue(this.radiusAdd);
        
        linearFitDialog.areaOfInterestCheckBox.checked = this.hasAreaOfInterest;
        linearFitDialog.rectangleX0_Control.setValue(this.areaOfInterest_X0);
        linearFitDialog.rectangleY0_Control.setValue(this.areaOfInterest_Y0);
        linearFitDialog.rectangleX1_Control.setValue(this.areaOfInterest_X1);
        linearFitDialog.rectangleY1_Control.setValue(this.areaOfInterest_Y1);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultReferenceView(activeWindow);
    this.targetView = getDefaultTargetView(activeWindow, this.referenceView);
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

// The main dialog function
function PhotometricMosaicDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            " &mdash; Corrects the scale and gradient between two images.</b><br />" +
            "(1) Each join must be approximately vertical or horizontal.<br />" +
            "(2) Join frames into either columns or rows.<br />" +
            "(3) Join these strips to create the final mosaic.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("Reference View:");
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference View:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = labelWidth1;
    referenceImage_Label.toolTip = "<p>This image will not have the scale or gradient applied.</p>";

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getMainViews();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = 
            "<p>This image will not have scale or gradient applied.</p>";
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
    targetImage_Label.toolTip = "<p>This image is first multiplied by " +
            "the photometrically determined scale factor and then the gradient " +
            "is calculated and subtracted.</p>";

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>This image is first multiplied by " +
            "the photometrically determined scale factor and then the gradient " +
            "is calculated and subtracted.</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    let labelSize = this.font.width("Line Segments:") + 9;
    //----------------------------------------------------
    // Star detection group box
    //----------------------------------------------------
    this.starDetectionControl = new NumericControl(this);
    this.starDetectionControl.real = true;
    this.starDetectionControl.label.text = "Star Detection:";
    this.starDetectionControl.label.minWidth = labelSize;
    this.starDetectionControl.toolTip = "<p>Smaller values detect more stars.</p>" +
            "<p>To test use the 'Star Mask' section; " +
            "select 'Test Mask' and set 'Limit Stars %' to 100%</p>";
    this.starDetectionControl.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetectionControl.setRange(-3, 3);
    this.starDetectionControl.slider.setRange(0, 600);
    this.starDetectionControl.setPrecision(1);
    this.starDetectionControl.slider.minWidth = 200;
    this.starDetectionControl.setValue(data.logStarDetection);
    
    let starDetectionSizer = new HorizontalSizer;
    starDetectionSizer.spacing = 4;
    starDetectionSizer.add(this.starDetectionControl);
    starDetectionSizer.addStretch();

    let starDetectionGroupBox = createGroupBox(this, "Star Detection");
    starDetectionGroupBox.sizer.add(starDetectionSizer);
    //----------------------------------------------------
    // photometry group box
    //----------------------------------------------------
    this.rejectHigh_Control = new NumericControl(this);
    this.rejectHigh_Control.real = true;
    this.rejectHigh_Control.label.text = "Linear Range:";
    this.rejectHigh_Control.label.minWidth = labelSize;
    this.rejectHigh_Control.toolTip = "<p>Only use pixels within the camera's " +
            "linear range.</p><p>Check that the points plotted within the " +
            "'Photometry Graph' show a linear response.</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.rejectHigh = value;
    };
    this.rejectHigh_Control.setRange(0.3, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 500);
    this.rejectHigh_Control.setPrecision(2);
    this.rejectHigh_Control.slider.minWidth = 206;
    this.rejectHigh_Control.setValue(data.rejectHigh);

    this.photometryGraphControl = new CheckBox(this);
    this.photometryGraphControl.text = "Photometry Graph";
    this.photometryGraphControl.toolTip = 
            "<p>Compares reference and target star flux and displays their " +
            "least squares fit line.</p>" +
            "<p>The gradient indicates the required scale factor.</p>" +
            "<p>If the plotted points show a non linear response, reduce the 'linear Range'";
    this.photometryGraphControl.checked = data.photometryGraphFlag;
    this.photometryGraphControl.onClick = function (checked) {
        data.photometryGraphFlag = checked;
    };

    this.displayStarsControl = new CheckBox(this);
    this.displayStarsControl.text = "Photometry Stars";
    this.displayStarsControl.toolTip = "<p>Indicates the stars that were within " +
            "the 'Linear Range' and that were found in both target and reference images.</p>" +
            "<p>A mask is created that uses circles to indicate the stars used. " +
            "Apply this mask to the reference image to visualise.</p>";
    this.displayStarsControl.checked = data.displayStarsFlag;
    this.displayStarsControl.onClick = function (checked) {
        data.displayStarsFlag = checked;
    };

    let photometrySizer = new HorizontalSizer;
    photometrySizer.spacing = 4;
    photometrySizer.add(this.rejectHigh_Control);
    photometrySizer.addSpacing(10);
    photometrySizer.add(this.photometryGraphControl);
    photometrySizer.addSpacing(10);
    photometrySizer.add(this.displayStarsControl);
    photometrySizer.addStretch();
    
    this.OutlierRemoval = new NumericControl(this);
    this.OutlierRemoval.real = false;
    this.OutlierRemoval.label.text = "Outlier Removal:";
    this.OutlierRemoval.label.minWidth = labelSize;
    this.OutlierRemoval.toolTip = "<p>Number of outlier stars to remove</p>" +
            "<p>Check that the points plotted within the 'Photometry Graph'" +
            " and use this control to reject the worst outliers.</p>";
    this.OutlierRemoval.onValueUpdated = function (value) {
        data.outlierRemoval = value;
    };
    this.OutlierRemoval.setRange(0, 10);
    this.OutlierRemoval.slider.setRange(0, 10);
    this.OutlierRemoval.slider.minWidth = 220;
    this.OutlierRemoval.setValue(data.outlierRemoval);
    let outlierSizer = new HorizontalSizer;
    outlierSizer.spacing = 4;
    outlierSizer.add(this.OutlierRemoval);
    outlierSizer.addStretch();

    let photometryGroupBox = createGroupBox(this, "Photometric Scale");
    photometryGroupBox.sizer.add(photometrySizer);
    photometryGroupBox.sizer.add(outlierSizer);

    //-------------------------------------------------------
    // Gradient detection group box
    //-------------------------------------------------------
    let directionLabel = new Label(this);
    directionLabel.text = "Direction:";
    directionLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    directionLabel.minWidth = labelSize;

    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = "<p>The orientation of the line of intersection. " +
            "'Auto' usually works well.</p>" +
            "<p>This script is designed to apply the horizontal and vertical components " +
            "of the gradient separately so it works best for joins that are " +
            "approximately horizontal or vertial.</p>" +
            "<p>To avoid adding a 'corner' with both a horizontal and vertical join, " +
            "build up the mosaic as rows or columns. Then join these strips to " +
            "create the final mosaic.</p>";
    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.addItem("Auto");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
    };

    this.displayGraphControl = new CheckBox(this);
    this.displayGraphControl.text = "Gradient Graph";
    this.displayGraphControl.toolTip = 
            "<p>The vertical axis represents the difference between the two images." +
            "The horizontal axis represents the join's X-Coordinate (horizontal join) " +
            "or Y-Coordinate (vertical join).</p>" +
            "<p>If a small proportion of the plotted points have excessive scatter, " +
            "this indicates that some samples contain bright stars that occupy more " +
            "than half the sample area. Either increase the 'Sample Size' to increase " +
            "the sample area, or increase the 'Limit Stars %' so that samples that " +
            "contain bright stars are rejected.</p>" +
            "<p>To increase the number of sample points, decrease 'Limit Stars %' " +
            "or reduce the 'Sample Size'.</p>";
    this.displayGraphControl.checked = data.displayGraphFlag;
    this.displayGraphControl.onClick = function (checked) {
        data.displayGraphFlag = checked;
    };
    this.displaySampleControl = new CheckBox(this);
    this.displaySampleControl.text = "Display Samples";
    this.displaySampleControl.toolTip = 
            "<p>Display the samples that will be used to calculate the background gradient.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they contain a bright star.</p>" +
            "<p>A mask is created and the surviving samples are drawn as squares. " +
            "The stars used to reject samples are drawn as circles. " +
            "Apply this mask to the reference image to visualise.</p>" +
            "<p>If too many samples are rejected, decrease 'Limit Stars %'. " +
            "This script uses the median value from each sample, so any star that " +
            "takes up less than half the sample area will have little effect. " +
            "These samples do not need to be rejected.</p>" +
            "<p>Using samples to determine the background gradient ensures that " +
            "the calculation is unaffected by bright stars with differing FWHM sizes.</p>";
    this.displaySampleControl.checked = data.displaySamplesFlag;
    this.displaySampleControl.onClick = function (checked) {
        data.displaySamplesFlag = checked;
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(directionLabel);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displayGraphControl);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displaySampleControl);
    orientationSizer.addStretch();

    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = true;
    this.sampleSize_Control.label.text = "Sample Size:";
    this.sampleSize_Control.label.minWidth = labelSize;
    this.sampleSize_Control.toolTip = 
            "<p>Sets the size of the sample squares. " + 
            "Using samples to determine the background gradient ensures that " +
            "the calculation is unaffected by bright stars with differing FWHM sizes.</p>" +
            "<p>Samples will be rejected if they contain one or more zero pixels in " +
            "either image or if they contain a star bright enough to be included " +
            "in the 'Limit Stars %' list.</p>" +
            "<p>Larger samples are more tolerant to bright stars. " +
            "Smaller samples might be necessary for small overlaps. " +
            "Ideally set to about 1.5x the size of the largest " +
            "star in the ovalapping region. Rejecting samples that contain stars " +
            "reduces this requirement</p>" +
            "<p>If too many samples are rejected, decrease 'Limit Stars %'. " +
            "This script uses the median value from each sample, so any star that " +
            "takes up less than half the sample area will have little effect. " +
            "These samples do not need to be rejected.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(3, 50);
    this.sampleSize_Control.slider.setRange(3, 50);
    this.sampleSize_Control.setPrecision(0);
    this.sampleSize_Control.slider.minWidth = 200;
    this.sampleSize_Control.setValue(data.sampleSize);

    this.limitSampleStarsPercent_Control = new NumericControl(this);
    this.limitSampleStarsPercent_Control.real = true;
    this.limitSampleStarsPercent_Control.label.text = "Limit Stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = labelSize;
    this.limitSampleStarsPercent_Control.toolTip = 
            "<p>Specifies the percentage of detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples. " +
            "This can dramatically reduce the number of surviving samples and is " +
            "usually unnecessary. This script uses the median pixel value within a " +
            "sample, so any star that takes up less then half the sample's area " +
            "will have little affect.</p>";
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    this.limitSampleStarsPercent_Control.setRange(0, 100);
    this.limitSampleStarsPercent_Control.slider.setRange(0, 100);
    this.limitSampleStarsPercent_Control.setPrecision(0);
    this.limitSampleStarsPercent_Control.slider.minWidth = 200;
    this.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);

    this.lineSegments_Control = new NumericControl(this);
    this.lineSegments_Control.real = false;
    this.lineSegments_Control.label.text = "Line Segments:";
    this.lineSegments_Control.label.minWidth = labelSize;
    this.lineSegments_Control.toolTip = "<p>The number of lines used to fit the data. " +
            "Too many lines may fit noise or artifacts.</p>";
    this.lineSegments_Control.onValueUpdated = function (value) {
        data.nLineSegments = value;
    };
    this.lineSegments_Control.setRange(1, 49);
    this.lineSegments_Control.slider.setRange(1, 25);
    this.lineSegments_Control.slider.minWidth = 200;
    this.lineSegments_Control.setValue(data.nLineSegments);
    
    let taperTooltip = "<p>The gradient offset is applied to the target image " +
            "along a line perpendicular to the horizontal or vertical join.<\p>" +
            "<p>When taper is selected, the correction applied is gradually " +
            "tapered down over the taper length to the average background level. " +
            "This prevents the local gradient corrections requied at the join from " +
            "propogating to the opposite edge of the target frame.<\p>" +
            "<p>If the 'Line Segments' is set to one, and the reference " +
            "image has little or no gradient, it can be helpful for the target " +
            "image's gradient correction to be propogated. This can help reduce " + 
            "the overall gradient in the final mosaic.</p>" +
            "<p>However, a propogated complex gradient curve is unlikely to " +
            "be helpful. In these cases, using a taper is recommended.<\p>" +
            "<p>In difficult cases it can be helpful to first use a single " +
            "'Line Segment' and propogate the linear gradient. Then " +
            "correct the complex gradient with a taper to create the mosaic.<\p>";
    this.taperFlag_Control = new CheckBox(this);
    this.taperFlag_Control.text = "Taper";
    this.taperFlag_Control.toolTip = taperTooltip;
    this.taperFlag_Control.checked = data.taperFlag;
    this.taperFlag_Control.onClick = function (checked) {
        data.taperFlag = checked;
    };
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Length:";
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(50, 10000);
    this.taperLength_Control.slider.setRange(1, 200);
    this.taperLength_Control.slider.minWidth = 200;
    this.taperLength_Control.setValue(data.taperLength);
    
    let taperSizer = new HorizontalSizer;
    taperSizer.spacing = 4;
    taperSizer.add(this.taperFlag_Control);
    taperSizer.add(this.taperLength_Control);

    let gradientGroupBox = createGroupBox(this, "Gradient Offset");
    gradientGroupBox.sizer.add(orientationSizer);
    gradientGroupBox.sizer.add(this.sampleSize_Control);
    gradientGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    gradientGroupBox.sizer.add(this.lineSegments_Control);
    gradientGroupBox.sizer.add(taperSizer);

    //-------------------------------------------------------
    // Mosaic Group Box
    //-------------------------------------------------------
    let mosaic_Label = new Label(this);
    mosaic_Label.text = "Mosaic:";
    mosaic_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    mosaic_Label.minWidth = this.font.width(mosaic_Label.text);

    this.displayMosaicControl = new CheckBox(this);
    this.displayMosaicControl.text = "Create Mosaic";
    this.displayMosaicControl.toolTip = 
            "<p>Combiens the reference and target frames together and " +
            "displays the result in the '" + MOSAIC_NAME() + "' window<\p>" +
            "<p>If the '" + MOSAIC_NAME() + "' window exists, its content is replaced. " +
            "If it does not, it is created.</p>" +
            "<p>After the first mosaic join, it is usually convenient to set " +
            "the reference view to '" + MOSAIC_NAME() + "'<\p>";
    this.displayMosaicControl.checked = data.createMosaicFlag;
    this.displayMosaicControl.onClick = function (checked) {
        data.createMosaicFlag = checked;
    };

    let overlay_Label = new Label(this);
    overlay_Label.text = "Overlay:";
    overlay_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    overlay_Label.minWidth = this.font.width("Overlay:");

    this.mosaicOverlayRefControl = new RadioButton(this);
    this.mosaicOverlayRefControl.text = "Reference";
    this.mosaicOverlayRefControl.toolTip = 
            "<p>The reference image pixels are drawn on top of the target image.<\p>";
    this.mosaicOverlayRefControl.checked = data.mosaicOverlayRefFlag;
    this.mosaicOverlayRefControl.onClick = function (checked) {
        data.mosaicOverlayRefFlag = checked;
        data.mosaicOverlayTgtFlag = !checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };
    
    this.mosaicOverlayTgtControl = new RadioButton(this);
    this.mosaicOverlayTgtControl.text = "Target";
    this.mosaicOverlayTgtControl.toolTip = 
            "<p>The target image pixels are drawn on top of the reference image.<\p>";
    this.mosaicOverlayTgtControl.checked = data.mosaicOverlayTgtFlag;
    this.mosaicOverlayTgtControl.onClick = function (checked) {
        data.mosaicOverlayTgtFlag = checked;
        data.mosaicOverlayRefFlag = !checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };

    this.mosaicRandomControl = new RadioButton(this);
    this.mosaicRandomControl.text = "Random";
    this.mosaicRandomControl.toolTip = "<p>Over the overlapping region " +
            "pixels are randomly choosen from the reference and target images.<\p>" +
            "<p>This mode is particularly effective at hiding the join, but if " +
            "the star profiles in the reference and target images don't match, " +
            "this can lead to speckled pixels around the stars.<\p>" +
            "<p>The speckled star artifacts can be fixed by using a mask that " +
            "only reveals the bright stars. Then use pixelMath to set the stars " +
            "to either the reference or target image. " +
            "The 'Star Mask' section has been provided for this purpose.<\p>";
    this.mosaicRandomControl.checked = data.mosaicRandomFlag;
    this.mosaicRandomControl.onClick = function (checked) {
        data.mosaicRandomFlag = checked;
        data.mosaicOverlayRefFlag = !checked;
        data.mosaicOverlayTgtFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };
    this.mosaicAverageControl = new RadioButton(this);
    this.mosaicAverageControl.text = "Average";
    this.mosaicAverageControl.toolTip = "<p>Over the overlapping region " +
            "pixels are set to the average of the reference and target images.<\p>" +
            "<p>This mode has the advantage of increasing the signal to noise ratio " +
            "over the join, but this can also make the join more visible.<\p>";
    this.mosaicAverageControl.checked = data.mosaicAverageFlag;
    this.mosaicAverageControl.onClick = function (checked) {
        data.mosaicAverageFlag = checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicOverlayRefFlag = !checked;
        data.mosaicOverlayTgtFlag = !checked;
    };

    let mosaic_Sizer = new HorizontalSizer;
    mosaic_Sizer.spacing = 10;
    mosaic_Sizer.add(mosaic_Label);
    mosaic_Sizer.add(this.displayMosaicControl);
    mosaic_Sizer.addSpacing(50);
    mosaic_Sizer.add(overlay_Label);
    mosaic_Sizer.add(this.mosaicOverlayRefControl);
    mosaic_Sizer.add(this.mosaicOverlayTgtControl);
    mosaic_Sizer.add(this.mosaicRandomControl);
    mosaic_Sizer.add(this.mosaicAverageControl);
    mosaic_Sizer.addStretch();

    let mosaicGroupBox = createGroupBox(this, "Mosaic");
    mosaicGroupBox.sizer.add(mosaic_Sizer);
    
    //-------------------------------------------------------
    // Mask Generation Group Box
    //-------------------------------------------------------
    this.starMaskFlagControl = new CheckBox(this);
    this.starMaskFlagControl.text = "Create Star Mask";
    this.starMaskFlagControl.toolTip = 
            "<p>Creates a star mask that reveals bright stars.<\p>" +
            "<p>A mosaic join using the 'Random' mode is highly effective, but " +
            "often produces speckled star edges around bright stars. This " +
            "mask option is provided to help fix this.<\p>";
    this.starMaskFlagControl.checked = data.displayMaskFlag;
    this.starMaskFlagControl.onClick = function (checked) {
        data.displayMaskFlag = checked;
    };
    
    this.testMaskFlagControl = new CheckBox(this);
    this.testMaskFlagControl.text = "Test Mask";
    this.testMaskFlagControl.toolTip = 
            "<p>Use this option while experimenting with the mask settings.<\p>" +
            "<p>When selected the processing is reduced to just creating this mask " +
            "plus a mask that just contains circles. " +
            "These circles indicate which stars will be revealed by the mask.<\p>" +
            "<p>Use the 'Area of Interest' to limit the test stars to a small " +
            "but representative area.<\p>";
    this.testMaskFlagControl.checked = data.testMaskOnly;
    this.testMaskFlagControl.onClick = function (checked) {
        data.testMaskOnly = checked;
    };
    
    let mask_Sizer = new HorizontalSizer;
    mask_Sizer.spacing = 4;
    mask_Sizer.add(this.starMaskFlagControl);
    mask_Sizer.addSpacing(20);
    mask_Sizer.add(this.testMaskFlagControl);
    mask_Sizer.addStretch();
    
    let starMaskLabelSize = this.font.width("Multiply Star Radius:");
    this.LimitMaskStars_Control = new NumericControl(this);
    this.LimitMaskStars_Control.real = false;
    this.LimitMaskStars_Control.label.text = "Limit Stars %:";
    this.LimitMaskStars_Control.toolTip =
            "<p>Specifies the percentage of detected stars that will be used to " +
            "create the star mask.</p>" +
            "<p>0% will produce a solid mask with no stars.<br />" +
            "100% will produce a mask that includes all detected stars.</p>" +
            "<p>Small faint stars are usually free of artifacts, so normally " +
            "only a small percentage of the detected stars need to be used.</p>";
    this.LimitMaskStars_Control.label.setFixedWidth(starMaskLabelSize);
    this.LimitMaskStars_Control.setRange(0, 100);
    this.LimitMaskStars_Control.slider.setRange(0, 100);
    this.LimitMaskStars_Control.setPrecision(0);
    this.LimitMaskStars_Control.slider.minWidth = 200;
    this.LimitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    this.LimitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
    };
    
    this.StarRadiusMultiply_Control = new NumericControl(this);
    this.StarRadiusMultiply_Control.real = true;
    this.StarRadiusMultiply_Control.label.text = "Multiply Star Radius:";
    this.StarRadiusMultiply_Control.toolTip = 
            "<p>Sets the mask star radius to a multiple of the star's radius.</p>" +
            "<p>This increases the size for large stars more than for the small ones.<\p>";
    this.StarRadiusMultiply_Control.setRange(1, 5);
    this.StarRadiusMultiply_Control.slider.setRange(1, 150);
    this.StarRadiusMultiply_Control.setPrecision(1);
    this.StarRadiusMultiply_Control.slider.minWidth = 150;
    this.StarRadiusMultiply_Control.setValue(data.radiusMult);
    this.StarRadiusMultiply_Control.onValueUpdated = function (value) {
        data.radiusMult = value;
    };
    
    this.StarRadiusAdd_Control = new NumericControl(this);
    this.StarRadiusAdd_Control.real = true;
    this.StarRadiusAdd_Control.label.text = "Add to Star Radius:";
    this.StarRadiusAdd_Control.toolTip = 
            "<p>Used to increases or decreases the radius of all mask stars.</p>" +
            "<p>This is applied after the 'Multiply Star Radius'.<\p>";
    this.StarRadiusAdd_Control.setRange(-5, 10);
    this.StarRadiusAdd_Control.slider.setRange(0, 150);
    this.StarRadiusAdd_Control.setPrecision(1);
    this.StarRadiusAdd_Control.slider.minWidth = 150;
    this.StarRadiusAdd_Control.setValue(data.radiusAdd);
    this.StarRadiusAdd_Control.onValueUpdated = function (value) {
        data.radiusAdd = value;
    };
    
    let radiusHorizontalSizer = new HorizontalSizer;
    radiusHorizontalSizer.spacing = 20;
    radiusHorizontalSizer.add(this.StarRadiusMultiply_Control);
    radiusHorizontalSizer.add(this.StarRadiusAdd_Control);
    //radiusHorizontalSizer.addStretch();

    let starMaskGroupBox = createGroupBox(this, "Star Mask");
    starMaskGroupBox.sizer.add(mask_Sizer);
    starMaskGroupBox.sizer.add(this.LimitMaskStars_Control);
    starMaskGroupBox.sizer.add(radiusHorizontalSizer);

    //-------------------------------------------------------
    // Area of interest
    //-------------------------------------------------------
    let labelWidth2 = this.font.width("Height:_");

    this.rectangleX0_Control = createNumericEdit("Left:", "Top left of rectangle X-Coordinate.", data.areaOfInterest_X0, labelWidth2, 50);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.areaOfInterest_X0 = value;
    };
    this.rectangleY0_Control = createNumericEdit("Top:", "Top left of rectangle Y-Coordinate.", data.areaOfInterest_Y0, labelWidth2, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y0 = value;
    };
    this.rectangleX1_Control = createNumericEdit("Right:", "Bottom right of rectangle X-Coordinate.", data.areaOfInterest_X1, labelWidth2, 50);
    this.rectangleX1_Control.onValueUpdated = function (value){
        data.areaOfInterest_X1 = value;
    };
    this.rectangleY1_Control = createNumericEdit("Bottom:", "Bottom right of rectangle Y-Coordinate.", data.areaOfInterest_Y1, labelWidth2, 50);
    this.rectangleY1_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y1 = value;
    };

    this.areaOfInterestCheckBox = new CheckBox(this);
    this.areaOfInterestCheckBox.text = "Area of Interest";
    this.areaOfInterestCheckBox.toolTip = "Limit samples to area of interest";
    this.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
    this.areaOfInterestCheckBox.onClick = function (checked) {
        data.hasAreaOfInterest = checked;
    };

    let coordHorizontalSizer = new HorizontalSizer;
    coordHorizontalSizer.spacing = 10;
    coordHorizontalSizer.add(this.areaOfInterestCheckBox);
    coordHorizontalSizer.addSpacing(20);
    coordHorizontalSizer.add(this.rectangleX0_Control);
    coordHorizontalSizer.add(this.rectangleY0_Control);
    coordHorizontalSizer.add(this.rectangleX1_Control);
    coordHorizontalSizer.add(this.rectangleY1_Control);
    coordHorizontalSizer.addStretch();

    // Area of interest Target->preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = "Get area from preview:";
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

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
            data.areaOfInterest_X0 = rect.x0;
            data.areaOfInterest_Y0 = rect.y0;
            data.areaOfInterest_X1 = rect.x1;
            data.areaOfInterest_Y1 = rect.y1;

            this.dialog.rectangleX0_Control.setValue(data.areaOfInterest_X0);
            this.dialog.rectangleY0_Control.setValue(data.areaOfInterest_Y0);
            this.dialog.rectangleX1_Control.setValue(data.areaOfInterest_X1);
            this.dialog.rectangleY1_Control.setValue(data.areaOfInterest_Y1);
        }
    };

    let previewImage_Sizer = new HorizontalSizer;
    previewImage_Sizer.spacing = 4;
    previewImage_Sizer.add(previewImage_Label);
    previewImage_Sizer.add(this.previewImage_ViewList, 100);
    previewImage_Sizer.addSpacing(10);
    previewImage_Sizer.add(previewUpdateButton);

    let areaOfInterest_GroupBox = createGroupBox(this, "Area of Interest");
    areaOfInterest_GroupBox.sizer.add(coordHorizontalSizer, 10);
    areaOfInterest_GroupBox.sizer.add(previewImage_Sizer);

    const helpWindowTitle = TITLE() + " v" + VERSION();
    const HELP_MSG =
            "<p>See tooltips</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, HELP_MSG);

    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleLabel);
//    this.sizer.addSpacing(4);
    this.sizer.add(referenceImage_Sizer);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(starDetectionGroupBox);
    this.sizer.add(photometryGroupBox);
    this.sizer.add(gradientGroupBox);
    this.sizer.add(areaOfInterest_GroupBox);
    this.sizer.add(mosaicGroupBox);
    this.sizer.add(starMaskGroupBox);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
PhotometricMosaicDialog.prototype = new Dialog;

// Photometric Mosaic main process
function main() {
//    GradientTest();
    
    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new PhotometricMosaicData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new PhotometricMosaicDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>" + TITLE() + " ", VERSION(), "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.referenceView.isNull) {
            (new MessageBox("WARNING: Reference view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.isColor !== data.referenceView.image.isColor) {
            (new MessageBox("ERROR: Cannot linear fit a B&W image with a colour image", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.fullId === data.referenceView.fullId ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Target and  Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        PhotometricMosaic(data);
        console.hide();

        // Quit after successful execution.
        //break;
    }

    return;
}

//function GradientTest(){
//    let x0 = 300;
//    let x1 = 500;
//    let y0 = 600;
//    let y1 = 700;
//    let average = 50;
//    let feather = 100;
//    let isHorizontal = true;
//    let gradOffset = new GradientOffset(1000, 1000, average, new Rect(x0, y0, x1, y1), feather, isHorizontal);
//    console.writeln("y = 0, offset = 50? ", gradOffset.getOffset(0, 250));
//    console.writeln("y = 499, offset = 50? ", gradOffset.getOffset(499, 250));
//    console.writeln("y = 525, offset = 50 + (250-50)/4 = 100? ", gradOffset.getOffset(525, 250));
//    console.writeln("y = 550, offset = 50 + (250-50)/2 = 150? ", gradOffset.getOffset(550, 250));
//    console.writeln("y = 575, offset = 50 + (250-50)*3/4 = 200? ", gradOffset.getOffset(575, 250));
//    console.writeln("y = 600, offset = 250? ", gradOffset.getOffset(600, 250));
//    console.writeln("y = 650, offset = 250? ", gradOffset.getOffset(650, 250));
//    console.writeln("y = 699, offset = 250? ", gradOffset.getOffset(699, 250));
//    console.writeln("y = 725, offset = 50 + (250-50)*3/4 = 200? ", gradOffset.getOffset(725, 250));
//    console.writeln("y = 750, offset = 50 + (250-50)/2 = 150? ", gradOffset.getOffset(750, 250));
//    console.writeln("y = 775, offset = 50 + (250-50)/4 = 100? ", gradOffset.getOffset(775, 250));
//    console.writeln("y = 800, offset = 50? ", gradOffset.getOffset(800, 250));
//    console.writeln("y = 999, offset = 50? ", gradOffset.getOffset(999, 250));
//    
//    let average = -50;
//    let feather = 200;
//    let isHorizontal = false;
//    let gradOffset = new GradientOffset(1000, 1000, average, new Rect(x0, y0, x1, y1), feather, isHorizontal);
//    console.writeln("x = 0, offset = -50? ", gradOffset.getOffset(0, 350));
//    console.writeln("x = 99, offset = -50? ", gradOffset.getOffset(99, 350));
//    console.writeln("x = 150, offset = -50 + (350+50)/4 = 50? ", gradOffset.getOffset(150, 350));
//    console.writeln("x = 200, offset = -50 + (350+50)/2 = 150? ", gradOffset.getOffset(200, 350));
//    console.writeln("x = 250, offset = -50 + (350+50)*3/4 = 250? ", gradOffset.getOffset(250, 350));
//    console.writeln("x = 300, offset = 350? ", gradOffset.getOffset(300, 350));
//    console.writeln("x = 400, offset = 350? ", gradOffset.getOffset(400, 350));
//    console.writeln("x = 499, offset = 350? ", gradOffset.getOffset(499, 350));
//    console.writeln("x = 550, offset = -50 + (350+50)*3/4 = 250? ", gradOffset.getOffset(550, 350));
//    console.writeln("x = 600, offset = -50 + (350+50)/2 = 150? ", gradOffset.getOffset(600, 350));
//    console.writeln("x = 650, offset = -50 + (350+50)/4 = 50? ", gradOffset.getOffset(650, 350));
//    console.writeln("x = 700, offset = -50? ", gradOffset.getOffset(700, 350));
//    console.writeln("x = 999, offset = -50? ", gradOffset.getOffset(999, 350));
//}

main();
