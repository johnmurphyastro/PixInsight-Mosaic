/* global StdIcon_Error, StdButton_Ok, StdIcon_Warning, StdButton_Abort, UndoFlag_Keywords, UndoFlag_PixelData, View, UndoFlag_NoSwapFile, PixelMath */
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
#include "lib/PhotometricMosaicDialog.js"
#include "lib/SamplePair.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/Cache.js"
#include "lib/StarLib.js"
#include "lib/Gradient.js"
#include "lib/FitsHeader.js"

function VERSION(){return  "1.1 beta";}
function TITLE(){return "Photometric Mosaic";}
function SCRIPT_NAME(){return "PhotometricMosaic";}
function TRIM_NAME(){return "TrimImage";}
function HORIZONTAL(){return 0;}
function VERTICAL(){return 1;}
function AUTO(){return 2;}
function MOSAIC_NAME(){return "Mosaic";}
function WINDOW_ID_PREFIX(){return "PM__";}
function DETECTED_STARS_FLAG(){return 1;}
function PHOTOMETRY_STARS_FLAG(){return 2;}
function PHOTOMETRY_GRAPH_FLAG(){return 4;}
function DISPLAY_SAMPLES_FLAG(){return 8;}
function GRADIENT_GRAPH_FLAG(){return 16;}
function MOSAIC_MASK_FLAG(){return 32;}
function MOSAIC_MASK_STARS_FLAG(){return 64;}

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

    console.writeln("Reference: <b>", referenceView.fullId, "</b>, Target: <b>", targetView.fullId, "</b>\n");
    processEvents();

    let areaOfInterest = null;
    if (data.hasAreaOfInterest) {
        areaOfInterest = new Rect(data.areaOfInterest_X0, data.areaOfInterest_Y0, 
                data.areaOfInterest_X1, data.areaOfInterest_Y1);
    }
    
    let detectedStars = new StarsDetected();
    detectedStars.detectStars(referenceView, targetView, areaOfInterest, 
            data.logStarDetection, data.starCache);
    if (detectedStars.overlapBox === null){
        let msgEnd = (areaOfInterest === null) ? "." : " within area of interest.";
        let errorMsg = "Error: '" + referenceView.fullId + "' and '" + targetView.fullId + "' do not overlap" + msgEnd;
        new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    processEvents();
    
    createOverlapPreview(targetView, detectedStars.overlapBox, data);
    
    if (data.viewFlag === DETECTED_STARS_FLAG()){
        displayDetectedStars(referenceView, detectedStars, targetView.fullId, 
                100, "__DetectedStars", data);
        return;
    }
    
    let colorStarPairs = detectedStars.getColorStarPairs(referenceView.image, targetView.image, data.rejectHigh);
    // Remove photometric star outliers and calculate the scale
    console.writeln("<b><u>Calculating scale</u></b>");
    for (let c = 0; c < nChannels; c++){
        let starPairs = colorStarPairs[c];
        starPairs.linearFitData = calculateScale(starPairs);
        for (let i=0; i<data.outlierRemoval; i++){
            if (starPairs.starPairArray.length < 4){
                console.warningln("Channel[", c, "]: Only ", starPairs.starPairArray.length, 
                    " photometry stars. Keeping outlier.");
                break;
            }
            starPairs = removeStarPairOutlier(starPairs, starPairs.linearFitData);
            starPairs.linearFitData = calculateScale(starPairs);
        }
    }
    if (targetView.image.isColor){
        console.writeln("Stars used for photometry: red " + colorStarPairs[0].starPairArray.length + 
                ", green " + colorStarPairs[1].starPairArray.length + 
                ", blue " + colorStarPairs[2].starPairArray.length);
    } else {
        console.writeln("Stars used for photometry: " + colorStarPairs[0].starPairArray.length);
    }
    processEvents();
    
    if (data.viewFlag === PHOTOMETRY_STARS_FLAG()) {
        displayPhotometryStars(referenceView, detectedStars, colorStarPairs, targetView.fullId, data);
        return;
    }
    if (data.viewFlag === PHOTOMETRY_GRAPH_FLAG()){
        displayStarGraph(referenceView, targetView, 800, colorStarPairs, data);
        return;
    }
    if (data.viewFlag === MOSAIC_MASK_FLAG()){
        displayMask(targetView, detectedStars, 
                data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, data);
        return;
    }
    if (data.viewFlag === MOSAIC_MASK_STARS_FLAG()){
        displayMaskStars(referenceView, detectedStars, targetView.fullId, 
                data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, 
                false, "__MosaicMaskStars", data);
        return;
    }

    // Calculate scale for target image.
    let scaleFactors = [];
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
        scaleFactors.push(starPairs.linearFitData);
        let text = "Calculated scale factor for " + targetView.fullId + " channel[" + c + "] x " + 
                starPairs.linearFitData.m.toPrecision(5);
        if (starPairs.starPairArray.length < 4){
            console.warningln(text + " (Warning: calculated from only " + starPairs.starPairArray.length + " stars)");
        } else {
            console.writeln(text);
        }
        processEvents();
    }
    
    let colorSamplePairs = createColorSamplePairs(targetView.image, referenceView.image, scaleFactors,
        data.sampleSize, detectedStars.allStars, 
        data.rejectHigh, data.limitSampleStarsPercent, detectedStars.overlapBox);
    let samplePairs = colorSamplePairs[0];
    if (samplePairs.samplePairArray.length < 2) {
        new MessageBox("Error: Too few samples to determine a linear fit.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    let sampleArea = samplePairs.getSampleArea();
    let isHorizontal = isJoinHorizontal(data, sampleArea);
    if (data.viewFlag === DISPLAY_SAMPLES_FLAG()){
        let title = WINDOW_ID_PREFIX() + targetView.fullId + "__Samples";
        displaySampleSquares(referenceView, colorSamplePairs[0], detectedStars, data.limitSampleStarsPercent, title, data);
        return;
    }

    // Calculate the gradient for each channel
    let gradients = [];
    let nLineSegments = (data.nLineSegments + 1) / 2;
    for (let c = 0; c < nChannels; c++) {
        samplePairs = colorSamplePairs[c];
        gradients[c] = new Gradient(samplePairs, nLineSegments, targetView.image, 
            detectedStars.overlapBox, isHorizontal);
    }
    if (data.viewFlag === GRADIENT_GRAPH_FLAG()) {
        displayGradientGraph(targetView, referenceView, 1000, isHorizontal, gradients, colorSamplePairs, data);
        return;
    }

    console.writeln("\n<b><u>Applying scale and gradients</u></b>");
    targetView.beginProcess(UndoFlag_PixelData | UndoFlag_Keywords);
    applyScaleAndGradient(targetView, isHorizontal, scaleFactors, gradients, detectedStars.overlapBox, 
        data.taperFlag, data.taperLength, data);
    data.starCache.invalidateTargetStars();

    // Save parameters to PixInsight history
    data.saveParameters();
    targetView.endProcess();
    processEvents();

    if (data.createMosaicFlag){
        let mosaicName = getUniqueViewId(MOSAIC_NAME());
        console.writeln("<b><u>Creating ", mosaicName, "</u></b>");

        processEvents();
        createMosaic(referenceView, targetView, mosaicName,
                data.mosaicOverlayRefFlag, data.mosaicOverlayTgtFlag, data.mosaicRandomFlag);
                
        let mosaicView = View.viewById(mosaicName);

        // Update Fits Header
        mosaicView.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        copyFitsObservation(referenceView, mosaicView);
        copyFitsAstrometricSolution(referenceView, mosaicView);
        copyFitsKeywords(referenceView, mosaicView, TRIM_NAME(), SCRIPT_NAME());
        copyFitsKeywords(targetView, mosaicView, TRIM_NAME(), SCRIPT_NAME());
        mosaicView.endProcess();

        // Create a preview a bit larger than the overlap bounding box to allow user to inspect.
        let x0 = Math.max(0, detectedStars.overlapBox.x0 - 50);
        let x1 = Math.min(mosaicView.image.width, detectedStars.overlapBox.x1 + 50);
        let y0 = Math.max(0, detectedStars.overlapBox.y0 - 50);
        let y1 = Math.min(mosaicView.image.height, detectedStars.overlapBox.y1 + 50);
        let previewRect = new Rect(x0, y0, x1, y1);
        let w = mosaicView.window;
        w.createPreview(previewRect, targetView.fullId);
        // But show the main mosaic view.
        w.currentView = mosaicView;
        w.zoomToFit();  
    }
    
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
    processEvents();
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
 * Appy scale and subtract the detected gradient from the target view
 * @param {View} view Apply the gradient correction to this view
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @param {LinearFitData[]} scaleFactors Scale to apply to target image.
 * @param {Gradient[]} gradients Gradient for each color channel
 * @param {Rect} overlapBox Bounding box of overlap region
 * @param {Boolean} taperFlag If true, apply taper to average offset in direction perpendicular to join
 * @param {Number} taperLength Length of taper to apply in pixels
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {undefined}
 */
function applyScaleAndGradient(view, isHorizontal, scaleFactors, gradients, overlapBox, 
        taperFlag, taperLength, data) {
    const applyScaleAndGradientTime = new Date().getTime();
    const targetImage = view.image;
    const width = targetImage.width;
    const height = targetImage.height;
    const updateInterval = height / 10;
    let yOld = 0;
    let oldTextLength = 0;
    
    let showProgress = function (y){
        let text = "" + Math.trunc((height - y) / height * 100) + "%";
        console.write(getDelStr() + text);
        processEvents();
        oldTextLength = text.length;
        yOld = y;
    };
    let getDelStr = function (){
        let bsp = "";
        for (let i = 0; i < oldTextLength; i++) {
            bsp += "<bsp>";
        }
        return bsp;
    };
    
    let nChannels = gradients.length;
    for (let channel = 0; channel < nChannels; channel++) {
        let scale = scaleFactors[channel].m;
        let gradientData = gradients[channel].getGradientData();
        let difArray = gradientData.difArray;
        let average = Math.mean(difArray);
        console.writeln("Channel[", channel, "] average offset ", average.toPrecision(5));
        let gradientOffset = new GradientOffset(targetImage.width, targetImage.height, 
                average, overlapBox, taperLength, isHorizontal);     
            
        oldTextLength = 0;
        yOld = height - 1;
        for (let y = height - 1; y > -1 ; --y) {
            let row = new Rect(0, y, width, y + 1);
            let samples = [];
            targetImage.getSamples(samples, row, channel);
            let rowUpdated = false;
            for (let x = samples.length - 1; x > -1; --x) {
                if (samples[x] !== 0) {
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
                    samples[x] = samples[x] * scale - offset;
                    rowUpdated = true;
                }
            }
            if (rowUpdated){
                view.image.setSamples(samples, row, channel);
            }
            
            if (y < yOld - updateInterval){
                showProgress(y);
            }
        }
        console.write(getDelStr());   // remove 100% from console
    }
    
    // FITS Header
    let keywords = view.window.keywords;
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + " " + VERSION()));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".ref: " + data.referenceView.fullId));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".tgt: " + data.targetView.fullId));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".starDetection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".linearRange: " + data.rejectHigh));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".outlierRemoval: " + data.outlierRemoval));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".sampleSize: " + data.sampleSize));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".limitStarsPercent: " + data.limitSampleStarsPercent));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".lineSegments: " + data.nLineSegments));
    if (taperFlag) {
        keywords.push(new FITSKeyword("HISTORY", "",
                SCRIPT_NAME() + ".taperLength: " + data.taperLength));
    }
    for (let c=0; c<nChannels; c++){
        keywords.push(new FITSKeyword("HISTORY", "", 
            SCRIPT_NAME() + ".scale[" + c + "]: " + scaleFactors[c].m.toPrecision(5)));
    }
    console.writeln("Applied scale and gradients (", getElapsedTime(applyScaleAndGradientTime), ")\n");
    
    let minValue = view.image.minimum();
    let maxValue = view.image.maximum();
    if (minValue < 0 || maxValue > 1){
        let minMaxValues = ": min = " + minValue.toPrecision(5) + ", max = " + maxValue.toPrecision(5);
        keywords.push(new FITSKeyword("HISTORY", "",
                SCRIPT_NAME() + ".truncated" + minMaxValues));
        console.warningln(view.fullId + ": min value = " + minValue + ", max value = " + maxValue + "\nTruncating image...\n");
        view.image.truncate(0, 1);
    }
    view.window.keywords = keywords;
}

/**
 * Create a mosaic by adding two images together.
 * Zero pixels are ignored.
 * 
 * @param {View} referenceView In overlay mode, displayed on top
 * @param {View} targetView In overlay mode, displayed beneath
 * @param {String} mosaicImageName
 * @param {Boolean} overlayRefFlag Set overlapping pixels to the reference image
 * @param {Boolean} overlayTgtFlag Set overlapping pixels to the target image
 * @param {Boolean} randomFlag Set overlapping pixels randomly to reference or target pixels
 * @returns {undefined}
 */
function createMosaic(referenceView, targetView, mosaicImageName,
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
    P.createNewImage = true;
    P.showNewImage = true;
    P.newImageId = mosaicImageName;
    P.newImageWidth = 0;
    P.newImageHeight = 0;
    P.newImageAlpha = false;
    P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
    P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
    P.executeOn(targetView, true); // used to get sample format and color space
    let mosaicView = View.viewById(mosaicImageName);
    mosaicView.stf = referenceView.stf;
}

/**
 *
 * @param {PhotometricMosaicData} data
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
 * Create preview of detected overlap in target image and update the areaOfInterest.
 * The detected overlap is the intersection between the areaOfInterest and the
 * actual overlap between the reference and target frames.
 * The areaOfInterest is then shrunk to this intersection.
 * @param {View} targetView
 * @param {Rect} overlapBox
 * @param {PhotometricMosaicData} data
 */
function createOverlapPreview(targetView, overlapBox, data){
    let w = targetView.window;
    let previews = w.previews;
    let overlap = overlapBox;
    let found = false;
    let overlapPreview = null;
    for (let preview of previews){
        let r = w.previewRect( preview );
        if (r.x0 === overlap.x0 && r.x1 === overlap.x1 &&
                r.y0 === overlap.y0 && r.y1 === overlap.y1){
            found = true; // preview already exists
            overlapPreview = preview;
            break;
        }
    }
    if (!found){
        let preview = w.createPreview(overlap, "Overlap");
        overlapPreview = preview;
    }
    
    // Set the preview data to the overlap bounding box.
    // The UI controls will be set when PhotmetricMosaic() returns to main
    data.hasAreaOfInterest = true;
    data.preview = overlapPreview;
    let rect = targetView.window.previewRect(data.preview);
    data.areaOfInterest_X0 = rect.x0;
    data.areaOfInterest_Y0 = rect.y0;
    data.areaOfInterest_X1 = rect.x1;
    data.areaOfInterest_Y1 = rect.y1;
}

/**
 * Create a viewId that does not already exist.
 * If viewId is already unique, return it.
 * If viewId is not unique, add a postfix number to make it unique.
 * PixInsight would do this automatically when a new ImageWindow is created, but
 * this routine can useful if we need to know the id of the new view
 * @param {String} viewId
 * @returns {String} unique viewId
 */
function getUniqueViewId(viewId) {
    let name = viewId;
    if (!View.viewById(name).isNull) {
        // The view name is aready in use.
        // find a unique name for the new view
        let nameBase = name;
        for (let i = 1; ; i++) {
            if (View.viewById(nameBase + i).isNull) {
                name = nameBase + i;
                break;
            }
        }
    }
    return name;
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
