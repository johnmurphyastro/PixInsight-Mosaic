/* global StdIcon_Error, StdButton_Ok, StdIcon_Warning, StdButton_Abort, UndoFlag_Keywords, UndoFlag_PixelData, View, UndoFlag_NoSwapFile, PixelMath, StdButton_Yes, StdIcon_Question, StdButton_No, StdIcon_Information */
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
#include "lib/SampleGrid.js"
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
function MOSAIC_NAME(){return "Mosaic";}
function WINDOW_ID_PREFIX(){return "PM__";}
function DISPLAY_DETECTED_STARS(){return 1;}
function DISPLAY_PHOTOMETRY_STARS(){return 2;}
function DISPLAY_PHOTOMETRY_GRAPH(){return 4;}
function DISPLAY_GRADIENT_SAMPLES(){return 8;}
function DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH(){return 16;}
function DISPLAY_OVERLAP_GRADIENT_GRAPH(){return 32;}
function CREATE_MOSAIC_MASK(){return 64;}
function DISPLAY_MOSAIC_MASK_STARS(){return 128;}
function CREATE_JOIN_MASK(){return 256;}
function DISPLAY_BINNED_SAMPLES(){return 512;}

/**
 * Controller. Processing starts here!
 * @param {PhotometricMosaicData} data Values from user interface
 */
function photometricMosaic(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let referenceView = data.referenceView;
    let nChannels = targetView.image.isColor ? 3 : 1;      // L = 0; R=0, G=1, B=2
    let overlap;
    
    // let the MosaicCache know about any relevant input parameter changes
    // If any of these inputs have changed, the cache will be invalidated
    data.cache.setUserInputData(referenceView.fullId, targetView.fullId, data.logStarDetection);
    
    // Overlap bounding box and overlap bitmap
    if (data.cache.overlap === null){
        // Create ref/tgt overlap bitmap (overlapMask) and its bounding box (ovelapBox)
        let overlapTime = new Date().getTime();
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
        overlap = new Overlap(referenceView.image, targetView.image);
        if (!overlap.hasOverlap()){
            let errorMsg = "Error: '" + referenceView.fullId + "' and '" + targetView.fullId + "' do not overlap.";
            new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        data.cache.setOverlap(overlap);
        console.writeln(getElapsedTime(overlapTime) + "\n");
        processEvents();
    } else {
        overlap = data.cache.overlap;
    }

    // joinRect is the intersection between JoinAreaPreview and the overlap,
    // or the overlapBox if the preview was not specified
    let isHorizontal;
    let joinRect;
    let overlapBox = overlap.overlapBox;
    createPreview(targetView, overlapBox, "Overlap");
    if (data.hasJoinAreaPreview) {
        let joinAreaPreview = data.joinAreaPreviewRect;
        if (!joinAreaPreview.intersects(overlapBox)){
            let errorMsg = "Error: Join Region preview does not intersect with the image overlap";
            new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        let intersectRect = joinAreaPreview.intersection(overlapBox);
        isHorizontal = isJoinHorizontal(data, intersectRect);
        if (data.cropTargetToJoinRegionFlag){
            joinRect = intersectRect;
        } else {
            joinRect = extendSubRect(intersectRect, overlapBox, isHorizontal);
        }
        // Show the join area in a preview
        createPreview(targetView, joinRect, "JoinRegion");
    } else {
        isHorizontal = isJoinHorizontal(data, overlapBox);
        joinRect = overlapBox;
    }

    if (data.viewFlag === CREATE_JOIN_MASK()){
        createJoinMask(targetView, overlap, joinRect);
        return;
    }

    let detectedStars = new StarsDetected();
    detectedStars.detectStars(referenceView, targetView, data.logStarDetection, data.cache);
    processEvents();
    
    if (data.viewFlag === DISPLAY_DETECTED_STARS()){
        displayDetectedStars(referenceView, detectedStars.refColorStars, "_ref", data);
        displayDetectedStars(targetView, detectedStars.tgtColorStars, "_tgt", data);
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
    
    // Photometry stars
    let colorStarPairs = detectedStars.getColorStarPairs(referenceView, data);
    let scaleFactors = [];
    
    // Remove photometric star outliers and calculate the scale
    console.writeln("\n<b><u>Calculating scale</u></b>");
    for (let c = 0; c < nChannels; c++){
        let starPairs = colorStarPairs[c];
        let linearFitData = calculateScale(starPairs);
        for (let i=0; i<data.outlierRemoval; i++){
            if (starPairs.length < 4){
                console.warningln("Channel[", c, "]: Only ", starPairs.length, 
                    " photometry stars. Keeping outlier.");
                break;
            }
            starPairs = removeStarPairOutlier(starPairs, linearFitData);
            linearFitData = calculateScale(starPairs);
        }
        scaleFactors.push(linearFitData);
    }
    if (targetView.image.isColor){
        console.writeln("Stars used for photometry: red " + colorStarPairs[0].length + 
                ", green " + colorStarPairs[1].length + 
                ", blue " + colorStarPairs[2].length);
    } else {
        console.writeln("Stars used for photometry: " + colorStarPairs[0].length);
    }
    let noStarsMsg = "";
    for (let c = 0; c < nChannels; c++){
        // For each color
        let starPairs = colorStarPairs[c];
        if (starPairs.length === 0){
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
    
    for (let c = 0; c < nChannels; c++){
        // For each color
        let text = "Calculated scale factor for " + targetView.fullId + " channel[" + c + "] x " + 
                scaleFactors[c].m.toPrecision(5);
        let nStarPairs = colorStarPairs[c].length;
        if (nStarPairs < 4){
            console.warningln(text + " (Warning: calculated from only " + nStarPairs + " stars)");
        } else {
            console.writeln(text);
        }
        processEvents();
    }
    
    if (data.viewFlag === DISPLAY_PHOTOMETRY_STARS()) {
        displayPhotometryStars(referenceView, detectedStars, colorStarPairs, scaleFactors, targetView.fullId, data);
        return;
    }
    if (data.viewFlag === DISPLAY_PHOTOMETRY_GRAPH()){
        console.hide(); // Allow user to compare with other open windows
        displayStarGraph(referenceView, targetView, colorStarPairs, scaleFactors, data);
        return;
    }
    
    let maxSampleSize = Math.floor(Math.min(overlapBox.height, overlapBox.width)/2);
    if (data.sampleSize > maxSampleSize){
        new MessageBox("Sample Size is too big for the overlap area.\n" +
                "Sample Size must be less than or equal to " + maxSampleSize, 
                TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    
    let colorSamplePairs = createSampleGrid(targetView.image, referenceView.image,
            scaleFactors, detectedStars.allStars, overlapBox, data, isHorizontal);
    if (colorSamplePairs[0].length < 3) {
        new MessageBox("Error: Too few samples to create a Surface Spline.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    if (data.viewFlag === DISPLAY_GRADIENT_SAMPLES()){
        let title = WINDOW_ID_PREFIX() + targetView.fullId + "__Samples";
        displaySampleGrid(referenceView, colorSamplePairs[0], detectedStars, title, data);
        return;
    }
    
    let unBinnedSamples = 0;
    let binnedSamples = 0;
    for (let c=0; c<nChannels; c++){
        unBinnedSamples = Math.max(unBinnedSamples, colorSamplePairs[c].length);
        colorSamplePairs[c] = createBinnedSampleGrid(overlapBox, colorSamplePairs[c], 
                isHorizontal, data.maxSamples);
        binnedSamples = Math.max(binnedSamples, colorSamplePairs[c].length);
    }
    
    if (data.viewFlag === DISPLAY_BINNED_SAMPLES()){
        if (unBinnedSamples < data.maxSamples){
            new MessageBox("Number of samples (" + unBinnedSamples + ") is less than Max Samples (" +
                    data.maxSamples + ")\nThe samples were not binned." , TITLE(), 
                    StdIcon_Information, StdButton_Ok).execute();
        } else {
            let title = WINDOW_ID_PREFIX() + targetView.fullId + "__Binned_Samples";
            displaySampleGrid(referenceView, colorSamplePairs[0], detectedStars, title, data);
        }
        return;
    }

    let isTargetAfterRef;
    if (data.cropTargetToJoinRegionFlag){
        isTargetAfterRef = null;
    } else if (isHorizontal){
        isTargetAfterRef = isImageBelowOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageBelowOverlap(referenceView.image, overlapBox, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let messageBox = new MessageBox("Is the reference frame above the target frame?",
                    "Failed to auto detect tile order", StdIcon_Question, StdButton_Yes, StdButton_No);
            isTargetAfterRef = (StdButton_Yes === messageBox.execute());
        }
    } else {
        isTargetAfterRef = isImageRightOfOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageRightOfOverlap(referenceView.image, overlapBox, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let messageBox = new MessageBox("Is the reference frame to the left of the target frame?",
                    "Failed to auto detect tile order", StdIcon_Question, StdButton_Yes, StdButton_No);
            isTargetAfterRef = (StdButton_Yes === messageBox.execute());
        }
    }

    // Calculate the gradient for each channel
    console.writeln("\n<b><u>Calculating surface spline</u></b>");
    if (binnedSamples < unBinnedSamples){
        console.writeln("Reduced number of samples from ", unBinnedSamples, " to ", binnedSamples);
    }
    let createSurfaceSplineTime = new Date().getTime();
    let propagateSurfaceSplines;
    if (data.extrapolatedGradientFlag && data.viewFlag !== DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        propagateSurfaceSplines = [];
        try {
            for (let c = 0; c < nChannels; c++) {
                let samplePairs = colorSamplePairs[c];
                propagateSurfaceSplines[c] = calcSurfaceSpline(samplePairs, data.extrapolatedGradientSmoothness);        
            }
        } catch (ex){
            new MessageBox("Propagate Surface Spline error.\n" + ex.message, 
                    TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        
        if (data.viewFlag === DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH()) {
            console.hide(); // Allow user to compare with other open windows
            // This gradient is important after the edge of the overlap box
            GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                    propagateSurfaceSplines, joinRect, colorSamplePairs, data, true);
            return;
        }
    } else {
        propagateSurfaceSplines = null;
    }
    
    let surfaceSplines = [];
    try {
        for (let c = 0; c < nChannels; c++) {
            let samplePairs = colorSamplePairs[c];
            surfaceSplines[c] = calcSurfaceSpline(samplePairs, data.overlapGradientSmoothness);
        }
    } catch (ex){
        new MessageBox("Gradient Surface Spline error.\n" + ex.message, 
                TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    console.writeln(colorSamplePairs[0].length,
            " samples, ", getElapsedTime(createSurfaceSplineTime));

    if (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        console.hide(); // Allow user to compare with other open windows
        // This gradient is important at the join
        GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                surfaceSplines, joinRect, colorSamplePairs, data, false);
        return;
    }

    if (data.createMosaicFlag){
        console.writeln("\n<b><u>Creating Mosaic</u></b>");
    } else {
        console.writeln("\n<b><u>Applying scale and gradients</u></b>");
    }
    let imageWindow = createCorrectedView(referenceView, targetView, isHorizontal, isTargetAfterRef,
            scaleFactors, propagateSurfaceSplines, surfaceSplines, overlap, joinRect, data);
    imageWindow.show();
    imageWindow.zoomToFit();
    
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
    processEvents();
}

/**
 * @param {StarPair[]} starPairs
 * @returns {LinearFitData} Least Square Fit between reference & target star flux
 */
function calculateScale(starPairs) {
    let leastSquareFit = new LeastSquareFitAlgorithm();
    for (let starPair of starPairs) {
        leastSquareFit.addValue(starPair.tgtStar.flux, starPair.refStar.flux);
    }
    return leastSquareFit.getOriginFit();
}

/**
 * Appy scale and subtract the detected gradient from the target view
 * @param {View} refView Used to create mosaic. Read only.
 * @param {View} tgtView Used to create mosaic or to create corrected tgtView clone. Read only.
 * @param {Boolean} isHorizontal True if the join is horizontal
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @param {LinearFitData[]} scaleFactors Scale for each color channel.
 * @param {SurfaceSpline[]} propagateSurfaceSplines SurfaceSpline for each color channel, propogated
 * @param {SurfaceSpline[]} surfaceSplines SurfaceSpline for each color channel, tapered
 * @param {Overlap} overlap represents overlap region
 * @param {Rect} joinRect Bounding box of join region (preview extended to overlapBox)
 * @param {PhotometricMosaicData} data User settings for FITS header
 * @returns {ImageWindow} Cloned image with corrections applied
 */
function createCorrectedView(refView, tgtView, isHorizontal, isTargetAfterRef, 
        scaleFactors, propagateSurfaceSplines, surfaceSplines, overlap, joinRect, data) {
    let applyScaleAndGradientTime = new Date().getTime();
    let width = tgtView.image.width;
    let height = tgtView.image.height;
    let nChannels = scaleFactors.length;
    
    // Create a new view which will become either the mosaic view or the corrected target view
    let viewId = data.createMosaicFlag ? MOSAIC_NAME() : tgtView.fullId + "_PM";
    let w = tgtView.window;
    let imgWindow = new ImageWindow(width, height, nChannels, w.bitsPerSample, 
            w.isFloatSample, nChannels > 1, viewId);    
    imgWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
    let view = imgWindow.mainView;
    if (data.createMosaicFlag){
        // Start with the ref image and add then modify it with the target image
        view.image.assign(refView.image);
    } // Leave the image blank for a corrected target view
    
    // Apply scale and gradient to the cloned image
    let tgtCorrector = new ScaleAndGradientApplier(width, height, overlap, joinRect,
            isHorizontal, data, isTargetAfterRef);
    let tgtBox = overlap.tgtBox;                
    for (let channel = 0; channel < nChannels; channel++) {
        let scale = scaleFactors[channel].m;
        let propagateSurfaceSpline = null;
        if (data.extrapolatedGradientFlag){
            propagateSurfaceSpline = propagateSurfaceSplines[channel];
        }
        let surfaceSpline = surfaceSplines[channel];
        tgtCorrector.applyAllCorrections(refView.image, tgtView.image, view, scale, 
                propagateSurfaceSpline, surfaceSpline, tgtBox, channel);
    }
    
    let minValue = view.image.minimum();
    let maxValue = view.image.maximum();
    if (minValue < 0 || maxValue > 1){
        view.image.truncate(0, 1);
    }
    
    // FITS Header
    let keywords = imgWindow.keywords;
    if (data.createMosaicFlag){
        copyFitsObservation(refView, keywords);
        copyFitsAstrometricSolution(refView, keywords);
        copyFitsKeywords(refView, keywords, TRIM_NAME(), SCRIPT_NAME());
    } else {
        copyFitsObservation(tgtView, keywords);
        copyFitsAstrometricSolution(tgtView, keywords);
    }
    copyFitsKeywords(tgtView, keywords, TRIM_NAME(), SCRIPT_NAME());
    
    keywords.push(new FITSKeyword("HISTORY", "", SCRIPT_NAME() + " " + VERSION()));
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderPhotometry(keywords, data);
    fitsHeaderGradient(keywords, data, true, true);
    fitsHeaderOrientation(keywords, isHorizontal, isTargetAfterRef);
    fitsHeaderMosaic(keywords, data);
    fitsHeaderScale(keywords, scaleFactors);
    if (minValue < 0 || maxValue > 1){
        let minMaxValues = ": min = " + minValue.toPrecision(5) + ", max = " + maxValue.toPrecision(5);
        keywords.push(new FITSKeyword("HISTORY", "",
                SCRIPT_NAME() + ".truncated" + minMaxValues));
        console.warningln("Truncating image (min = " + minValue + ", max = " + maxValue + ")");
    }
    view.window.keywords = keywords;
    view.endProcess();
    view.stf = refView.stf;

    if (data.createMosaicFlag){
        // Create a preview a bit larger than the overlap bounding box to allow user to inspect.
        let x0 = Math.max(0, joinRect.x0 - 10);
        let x1 = Math.min(view.image.width, joinRect.x1 + 10);
        let y0 = Math.max(0, joinRect.y0 - 10);
        let y1 = Math.min(view.image.height, joinRect.y1 + 10);
        let previewRect = new Rect(x0, y0, x1, y1);
        imgWindow.createPreview(previewRect, "Inspect_Join");
    }
    // But show the main mosaic view.
    imgWindow.currentView = view;
    imgWindow.zoomToFit();
    
    console.writeln("Created ", view.fullId, " (", getElapsedTime(applyScaleAndGradientTime), ")");
    return imgWindow;
}

/**
 *
 * @param {PhotometricMosaicData} data
 * @param {Rect} joinRect
 * @returns {Boolean} True if the mosaic join is mostly horizontal
 */
function isJoinHorizontal(data, joinRect){
    let isHorizontal = joinRect.width > joinRect.height;
    if (data.cropTargetToJoinRegionFlag){
        console.writeln("<b>Mode: Crop target image to Join Region</b>");
    } else if (isHorizontal) {
        console.writeln("<b>Mode auto selected: Horizontal join</b>");
    } else {
        console.writeln("<b>Mode auto selected: Vertical join</b>");
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
    for (let preview of previews){
        let r = w.previewRect( preview );
        if (r.x0 === rect.x0 && r.x1 === rect.x1 &&
                r.y0 === rect.y0 && r.y1 === rect.y1){
            found = true; // preview already exists
            break;
        }
    }
    if (!found){
        w.createPreview(rect, previewName);
    }
}

main();