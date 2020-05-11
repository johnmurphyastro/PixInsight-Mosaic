/* global StdIcon_Error, StdButton_Ok, StdIcon_Warning, StdButton_Abort, UndoFlag_Keywords, UndoFlag_PixelData, View, UndoFlag_NoSwapFile, PixelMath, StdButton_Yes, StdIcon_Question, StdButton_No */
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
#feature-id Mosaic > PhotometricMosaic

#feature-info Calculates scale and gradient offset between two images over their overlapping area.<br/>\
Copyright &copy; 2019-2020 John Murphy.<br/> \
StarDetector.jsh: Copyright &copy; 2003-2019 Pleiades Astrophoto S.L. All Rights Reserved.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/PhotometricMosaicDialog.js"
#include "lib/SamplePair.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/Cache.js"
#include "lib/StarLib.js"
#include "lib/Gradient.js"
#include "lib/FitsHeader.js"
#include "lib/Geometry.js"

// To stop my IDE from generating warnings...
function VERSION(){return  "2.0";}
function TITLE(){return "Photometric Mosaic";}
function SCRIPT_NAME(){return "PhotometricMosaic";}
function TRIM_NAME(){return "TrimMosaicTile";}
function HORIZONTAL(){return 0;}
function VERTICAL(){return 1;}
function AUTO(){return 2;}
function MOSAIC_NAME(){return "Mosaic";}
function WINDOW_ID_PREFIX(){return "PM__";}
function DISPLAY_DETECTED_STARS(){return 1;}
function DISPLAY_PHOTOMETRY_STARS(){return 2;}
function DISPLAY_PHOTOMETRY_GRAPH(){return 4;}
function DISPLAY_GRADIENT_SAMPLES(){return 8;}
function DISPLAY_GRADIENT_GRAPH(){return 16;}
function DISPLAY_GRADIENT_TAPER_GRAPH(){return 32;}
function CREATE_MOSAIC_MASK(){return 64;}
function DISPLAY_MOSAIC_MASK_STARS(){return 128;}
function CREATE_JOIN_MASK(){return 256;}

/**
 * Controller. Processing starts here!
 * @param {PhotometricMosaicData} data Values from user interface
 */
function PhotometricMosaic(data)
{
    const startTime = new Date().getTime();
    const targetView = data.targetView;
    const referenceView = data.referenceView;
    const nChannels = targetView.image.isColor ? 3 : 1;      // L = 0; R=0, G=1, B=2
    
    // let the MosaicCache know about any relevant input parameter changes
    // If any of these inputs have changed, the cache will be invalidated
    data.cache.setUserInputData(referenceView.fullId, targetView.fullId, data.logStarDetection);
    
    // Overlap bounding box and overlap bitmap
    if (data.cache.overlap === null){
        // Create ref/tgt overlap bitmap (overlapMask) and its bounding box (ovelapBox)
        const overlapTime = new Date().getTime();
        // Add trim warning check here so it is only displayed once
        console.writeln("Reference: <b>", referenceView.fullId, "</b>, Target: <b>", targetView.fullId, "</b>\n");
        if (!searchFitsHistory(referenceView, TRIM_NAME())){
            console.warningln("Warning: '" + referenceView.fullId +"' has not been trimmed by the " + TRIM_NAME() + " script");
        }
        if (!searchFitsHistory(targetView, TRIM_NAME())){
            console.warningln("Warning: '" + targetView.fullId +"' has not been trimmed by the " + TRIM_NAME() + " script");
        }
        
        console.writeln("<b><u>Calculating overlap</u></b>");
        processEvents();
        let overlap = new Overlap(referenceView.image, targetView.image);
        if (!overlap.hasOverlap){
            let errorMsg = "Error: '" + referenceView.fullId + "' and '" + targetView.fullId + "' do not overlap.";
            new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        data.cache.setOverlap(overlap);
        console.writeln(getElapsedTime(overlapTime) + "\n");
        processEvents();
    }

    const detectedStars = new StarsDetected();
    detectedStars.detectStars(referenceView, targetView, data.logStarDetection, data.cache);
    createPreview(targetView, data.cache.overlap.overlapBox, "Overlap");
    processEvents();
    
    // sampleRect is the intersection between SampleAreaPreview and the overlap,
    // or the overlapBox if the preview was not specified
    let sampleRect;
    if (data.hasSampleAreaPreview) {
        let overlapBox = data.cache.overlap.overlapBox;
        let sampleAreaPreview = new Rect(data.sampleAreaPreview_X0, data.sampleAreaPreview_Y0, 
                data.sampleAreaPreview_X1, data.sampleAreaPreview_Y1);
        if (!sampleAreaPreview.intersects(overlapBox)){
            let errorMsg = "Error: Sample Area rectangle does not intersect with the image overlap";
            new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        sampleRect = sampleAreaPreview.intersection(overlapBox);
        createPreview(targetView, sampleRect, "SampleArea");
    } else {
        sampleRect = data.cache.overlap.overlapBox;
    }
    
    if (data.viewFlag === DISPLAY_DETECTED_STARS()){
        displayDetectedStars(referenceView, detectedStars, targetView.fullId, 
                100, "__DetectedStars", data);
        return;
    }
    
    // Photometry stars
    const colorStarPairs = detectedStars.getColorStarPairs(referenceView, data);
           
    // Remove photometric star outliers and calculate the scale
    console.writeln("\n<b><u>Calculating scale</u></b>");
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
    
    if (data.viewFlag === DISPLAY_PHOTOMETRY_STARS()) {
        displayPhotometryStars(referenceView, detectedStars, colorStarPairs, targetView.fullId, data);
        return;
    }
    if (data.viewFlag === DISPLAY_PHOTOMETRY_GRAPH()){
        let displayed = displayStarGraph(referenceView, targetView, 800, colorStarPairs, data);
        if (!displayed){
            new MessageBox("Unable to display the graph because no photometric stars were found.\n" +
                    "Decrease the 'Star Detection' setting to detect more stars " +
                    "or increase 'Linear Range'.", 
                    TITLE(), StdIcon_Error, StdButton_Ok).execute();
        }
        return;
    }
    
    const isHorizontal = isJoinHorizontal(data, sampleRect);
    const joinRect = extendSubRect(sampleRect, data.cache.overlap.overlapBox, isHorizontal);
    
    if (data.viewFlag === CREATE_JOIN_MASK()){
        createJoinMask(data.cache.overlap, joinRect);
        return;
    }
    
    if (data.viewFlag === CREATE_MOSAIC_MASK()){
        displayMask(targetView, joinRect, detectedStars, data);
        return;
    }
    if (data.viewFlag === DISPLAY_MOSAIC_MASK_STARS()){
        displayMaskStars(referenceView, joinRect, detectedStars, targetView.fullId,  
                false, "__MosaicMaskStars", data);
        return;
    }

    let noStarsMsg = "";
    for (let c = 0; c < nChannels; c++){
        // For each color
        let starPairs = colorStarPairs[c];
        if (starPairs.starPairArray.length === 0){
            noStarsMsg += "Channel [" + c + "] has no matching stars. Defaulting scale to 1.0\n";
        }
    }
    if (noStarsMsg.length !== 0){
        let messageBox = new MessageBox(noStarsMsg, "Warning: Failed to detect stars", StdIcon_Warning, StdButton_Ok, StdButton_Abort);
        if (StdButton_Abort === messageBox.execute()) {
            console.warningln("No matching stars. Aborting...");
            return;
        }
    }
    
    // Calculate scale for target image.
    let scaleFactors = [];
    for (let c = 0; c < nChannels; c++){
        // For each color
        let starPairs = colorStarPairs[c];
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
    
    let maxSampleSize = Math.min(sampleRect.height, sampleRect.width);
    if (data.sampleSize > maxSampleSize){
        new MessageBox("Sample Size is too big for the sample area.\n" +
                "Sample Size must be less than or equal to " + maxSampleSize, 
                TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    
    const colorSamplePairs = createColorSamplePairs(targetView.image, referenceView.image,
            scaleFactors, detectedStars.allStars, sampleRect, data, isHorizontal);
    let samplePairs = colorSamplePairs[0];
    if (samplePairs.samplePairArray.length < 2) {
        new MessageBox("Error: Too few samples to determine a linear fit.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    if (data.viewFlag === DISPLAY_GRADIENT_SAMPLES()){
        let title = WINDOW_ID_PREFIX() + targetView.fullId + "__Samples";
        displaySampleSquares(referenceView, colorSamplePairs[0], detectedStars, title, data);
        return;
    }

    // Calculate the gradient for each channel
    const gradientErrMsg = 
            "At least two samples per line segment are required.\n" +
            "Try decreasing either the number of line segments or the size of the samples.";
    let propagateGradient;
    if (data.gradientFlag) {
        propagateGradient = [];
        for (let c = 0; c < nChannels; c++) {
            samplePairs = colorSamplePairs[c];
            propagateGradient[c] = calcSmoothDifArray(targetView.image,
                    sampleRect, samplePairs, data.nGradientBestFitLines, isHorizontal);        
            if (null === propagateGradient[c]) {
                new MessageBox(gradientErrMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
                return;
            }
        }
    } else {
        propagateGradient = null;
    }
    let taperGradient;
    if (data.taperFlag) {
        taperGradient = [];
        for (let c = 0; c < nChannels; c++) {
            let smoothDifArray = data.gradientFlag ? propagateGradient[c] : null;
            samplePairs = colorSamplePairs[c];   
            taperGradient[c] = calcMovingAverageDifArray(targetView.image, sampleRect,
                    samplePairs, smoothDifArray, data.nTaperBestFitLines, isHorizontal);
        }
    } else {
        taperGradient = null;
    }

    if (data.viewFlag === DISPLAY_GRADIENT_GRAPH()) {
        displayGradientGraph(targetView, referenceView, 1000, isHorizontal,
                null, propagateGradient, colorSamplePairs, data);
        return;
    }

    if (data.viewFlag === DISPLAY_GRADIENT_TAPER_GRAPH()) {
        displayGradientGraph(targetView, referenceView, 1000, isHorizontal,
                propagateGradient, taperGradient, colorSamplePairs, data);
        return;
    }

    let isTargetAfterRef;
    if (isHorizontal){
        isTargetAfterRef = isImageBelowOverlap(targetView.image, joinRect, nChannels);
        let isRefAfterTarget = isImageBelowOverlap(referenceView.image, joinRect, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let messageBox = new MessageBox("Is the reference frame above the target frame?",
                    "Failed to auto detect tile order", StdIcon_Question, StdButton_Yes, StdButton_No);
            isTargetAfterRef = (StdButton_Yes === messageBox.execute());
        }
    } else {
        isTargetAfterRef = isImageRightOfOverlap(targetView.image, joinRect, nChannels);
        let isRefAfterTarget = isImageRightOfOverlap(referenceView.image, joinRect, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let messageBox = new MessageBox("Is the reference frame to the left of the target frame?",
                    "Failed to auto detect tile order", StdIcon_Question, StdButton_Yes, StdButton_No);
            isTargetAfterRef = (StdButton_Yes === messageBox.execute());
        }
    }

    console.writeln("\n<b><u>Applying scale and gradients</u></b>");
    let correctedView = applyScaleAndGradient(targetView, isHorizontal, isTargetAfterRef,
            scaleFactors, propagateGradient, taperGradient, joinRect, data);

    processEvents();

    if (data.createMosaicFlag){
        let mosaicName = getUniqueViewId(MOSAIC_NAME());
        console.writeln("<b><u>Creating ", mosaicName, "</u></b>");

        processEvents();
        createMosaic(referenceView, correctedView, mosaicName,
                 joinRect, isHorizontal, isTargetAfterRef, data);

        let mosaicView = View.viewById(mosaicName);

        // Update Fits Header
        mosaicView.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        copyFitsObservation(referenceView, mosaicView);
        copyFitsAstrometricSolution(referenceView, mosaicView);
        copyFitsKeywords(referenceView, mosaicView, TRIM_NAME(), SCRIPT_NAME());
        copyFitsKeywords(correctedView, mosaicView, TRIM_NAME(), SCRIPT_NAME());
        mosaicView.endProcess();

        // Don't need cloned target view any more
        correctedView.window.forceClose();
        
        let w = mosaicView.window;
        // Show the join area in a preview
        w.createPreview(joinRect, "Join");
        // Create a preview a bit larger than the overlap bounding box to allow user to inspect.
        let x0 = Math.max(0, joinRect.x0 - 50);
        let x1 = Math.min(mosaicView.image.width, joinRect.x1 + 50);
        let y0 = Math.max(0, joinRect.y0 - 50);
        let y1 = Math.min(mosaicView.image.height, joinRect.y1 + 50);
        let previewRect = new Rect(x0, y0, x1, y1);
        w.createPreview(previewRect, "Inspect_Join");
        // But show the main mosaic view.
        w.currentView = mosaicView;
        w.zoomToFit();
    } else {
        correctedView.stf = referenceView.stf;
        correctedView.window.show();
        correctedView.window.zoomToFit();
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
 * @param {View} tgtView Apply the gradient correction to a clone of this view
 * @param {Boolean} isHorizontal True if the join is horizontal
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @param {LinearFitData[]} scaleFactors Scale for each color channel.
 * @param {Number[][]} propagateGradient difArray for each color channel, propogated
 * @param {Number[][]} taperGradient difArray for each color channel, tapered
 * @param {Rect} joinRect Bounding box of join region
 * @param {PhotometricMosaicData} data User settings for FITS header
 * @returns {View} Clone of tgtView, with corrections applied
 */
function applyScaleAndGradient(tgtView, isHorizontal, isTargetAfterRef, 
        scaleFactors, propagateGradient, taperGradient, joinRect, data) {
    const applyScaleAndGradientTime = new Date().getTime();
    const width = tgtView.image.width;
    const height = tgtView.image.height;
    const nChannels = scaleFactors.length;
    
    // Clone the target view and image
    let w = tgtView.window;
    let imgWindow = new ImageWindow(width, height, nChannels, w.bitsPerSample, 
            w.isFloatSample, nChannels > 1, tgtView.fullId + "_PM");    
    imgWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
    let view = imgWindow.mainView;
    view.image.assign(tgtView.image);
    
    // Apply scale and gradient to the cloned image
    let tgtCorrector = new ScaleAndGradientApplier(width, height, joinRect,
            data.taperFlag, data.taperLength, isHorizontal, isTargetAfterRef);
    const tgtBox = data.cache.overlap.tgtBox;                
    for (let channel = 0; channel < nChannels; channel++) {
        let scale = scaleFactors[channel].m;
        let propagateDifArray = null;
        if (data.gradientFlag){
            propagateDifArray = propagateGradient[channel];
        }
        let taperDifArray = null;
        if (data.taperFlag){
            taperDifArray = taperGradient[channel];
        }
        tgtCorrector.applyAllCorrections(view, scale, propagateDifArray, taperDifArray, tgtBox, channel);
    }
    
    // FITS Header
    let keywords = tgtView.window.keywords;
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + " " + VERSION()));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".ref: " + data.referenceView.fullId));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".tgt: " + data.targetView.fullId));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".starDetection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".limitPhotometricStarsPercent: " + data.limitPhotoStarsPercent));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".linearRange: " + data.linearRange));
    keywords.push(new FITSKeyword("HISTORY", "",
        SCRIPT_NAME() + ".starSearchRadius: " + data.starSearchRadius));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".outlierRemoval: " + data.outlierRemoval));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".sampleSize: " + data.sampleSize));
    keywords.push(new FITSKeyword("HISTORY", "", 
        SCRIPT_NAME() + ".limitSampleStarsPercent: " + data.limitSampleStarsPercent));
    if (data.gradientFlag){
        keywords.push(new FITSKeyword("HISTORY", "", 
            SCRIPT_NAME() + ".nGradientBestFitLines: " + data.nGradientBestFitLines));
    }
    if (data.taperFlag) {
        keywords.push(new FITSKeyword("HISTORY", "", 
            SCRIPT_NAME() + ".nTaperBestFitLines: " + data.nTaperBestFitLines));
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
    
    view.endProcess();
    return view;
}

/**
 * Create a mosaic by adding two images together.
 * Zero pixels are ignored.
 * 
 * @param {View} referenceView
 * @param {View} targetView
 * @param {String} mosaicImageName
 * @param {Rect} joinRect Bounding box of overlap 
 * @param {Boolean} isHorizontal True if join is horizontal
 * @param {Boolean} isTargetAfterRef True if target is below or right of reference image
 * @param {PhotometricMosaicData} data User settings
 * @returns {undefined}
 */
function createMosaic(referenceView, targetView, mosaicImageName,
        joinRect, isHorizontal, isTargetAfterRef, data) {
    let P = new PixelMath;
    P.setDescription("Create Mosaic from " + referenceView.fullId + ", " + targetView.fullId);
    const ref = referenceView.fullId;
    const tgt = targetView.fullId;
    
    // Overlay reference: // iif( ref, ref, tgt )
    const refExp = "iif(" + ref + ", " + ref + ", " + tgt + ")";
    
    // Overlay target: iif( tgt, tgt, ref )
    const tgtExp = "iif(" + tgt + ", " + tgt + ", " + ref + ")";
    
    let expression;
    if (data.mosaicOverlayRefFlag) {
        expression = refExp;
    } else if (data.mosaicOverlayTgtFlag){
        expression = tgtExp;
    } else if (data.mosaicRandomFlag){
        // Random: iif( ref && tgt, rndselect( ref, tgt ), ref + tgt )
        expression = "iif(" + ref + " && " + tgt + ", rndselect(" + ref + ", " + tgt + "), " + ref + " + " + tgt + ")";
    } else {
        // Average: iif( ref && tgt, mean( ref, tgt ), ref + tgt )
        expression = "iif(" + ref + " && " + tgt + ", (" + ref + " + " + tgt + ")/2, " + ref + " + " + tgt + ")";
    }
    
    if (data.hasSampleAreaPreview) {
        let outerIf;
        if (isHorizontal) {
            outerIf = "iif(y() < " + joinRect.y0 + ", ";
            if (isTargetAfterRef) {
                // First region is ref side of join. Overlay reference
                outerIf += refExp;
            } else {
                // First region is tgt side of join. Overlay target
                outerIf += tgtExp;
            }
            outerIf += ", iif(y() >= " + joinRect.y1 + ", ";
            if (isTargetAfterRef) {
                // Last region is tgt side of join. Overlay target
                outerIf += tgtExp;
            } else {
                // Last region is ref side of join. Overlay reference
                outerIf += refExp;
            }
        } else {
            outerIf = "iif(x() < " + joinRect.x0 + ", ";
            if (isTargetAfterRef) {
                // First region is ref side of join. Overlay reference
                outerIf += refExp;
            } else {
                // First region is tgt side of join. Overlay target
                outerIf += tgtExp;
            }
            outerIf += ", iif(x() >= " + joinRect.x1 + ", ";
            if (isTargetAfterRef) {
                // Last region is tgt side of join. Overlay target
                outerIf += tgtExp;
            } else {
                // Last region is ref side of join. Overlay reference
                outerIf += refExp;
            }
        }
        expression = outerIf + ", " + expression + "))";
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
 * @param {Rect} sampleRect
 * @returns {Boolean} True if the mosaic join is mostly horizontal
 */
function isJoinHorizontal(data, sampleRect){
    if (data.orientation === HORIZONTAL()){
        console.writeln("<b>Mode: Horizontal Gradient</b>");
        return true;
    }
    if (data.orientation === VERTICAL()){
        console.writeln("<b>Mode: Vertical Gradient</b>");
        return false;
    }
    let isHorizontal = sampleRect.width > sampleRect.height;
    if (isHorizontal) {
        console.writeln("\n<b>Mode auto selected: Horizontal Gradient</b>");
    } else {
        console.writeln("\n<b>Mode auto selected: Vertical Gradient</b>");
    }
    return isHorizontal;
}

/**
 * Create a preview if it does not already exist
 * @param {View} targetView
 * @param {Rect} rect
 * @param {String} previewName
 */
function createPreview(targetView, rect, previewName){
    let w = targetView.window;
    let previews = w.previews;
    let found = false;
    let overlapPreview = null;
    for (let preview of previews){
        let r = w.previewRect( preview );
        if (r.x0 === rect.x0 && r.x1 === rect.x1 &&
                r.y0 === rect.y0 && r.y1 === rect.y1){
            found = true; // preview already exists
            overlapPreview = preview;
            break;
        }
    }
    if (!found){
        let preview = w.createPreview(rect, previewName);
        overlapPreview = preview;
    }
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
