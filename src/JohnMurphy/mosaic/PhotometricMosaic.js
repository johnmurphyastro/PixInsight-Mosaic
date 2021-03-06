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

#feature-info Creates mosaics from previously registered images, using photometry \
to determine the brightness scale factor and a surface spline to model the relative gradient.<br/>\
Copyright &copy; 2019-2020 John Murphy.<br/> \
StarDetector.jsh: Copyright &copy; 2003-2019 Pleiades Astrophoto S.L. All Rights Reserved.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogControls.js"
#include "lib/PhotometricMosaicDialog.js"
#include "lib/SampleGrid.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/Cache.js"
#include "lib/StarLib.js"
#include "lib/Gradient.js"
#include "lib/GradientGraph.js"
#include "lib/GradientGraphDialog.js"
#include "lib/FitsHeader.js"
#include "lib/Geometry.js"
#include "lib/PreviewControl.js"
#include "lib/SampleGridDialog.js"
#include "lib/DetectedStarsDialog.js"
#include "lib/PhotometryGraphDialog.js"
#include "lib/MaskStarsDialog.js"
#include "extraControls/BinnedSampleGridDialog.js"

// To stop my IDE from generating warnings...
function VERSION(){return "3.0";}
function TITLE(){return "Photometric Mosaic";}
function SCRIPT_NAME(){return "PhotometricMosaic";}
function TRIM_NAME(){return "TrimMosaicTile";}
function MOSAIC_NAME(){return "Mosaic";}
function WINDOW_ID_PREFIX(){return "PM__";}
function DISPLAY_DETECTED_STARS(){return 1;}
function DISPLAY_PHOTOMETRY_GRAPH(){return 4;}
function DISPLAY_GRADIENT_SAMPLES(){return 8;}
function DISPLAY_TARGET_GRADIENT_GRAPH(){return 16;}
function DISPLAY_OVERLAP_GRADIENT_GRAPH(){return 32;}
function DISPLAY_MOSAIC_MASK_STARS(){return 128;}
function DISPLAY_BINNED_SAMPLES(){return 512;}

/**
 * Controller. Processing starts here!
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog 
 */
function photometricMosaic(data, photometricMosaicDialog)
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
        console.writeln("<b><u>Calculating overlap</u></b>");
        processEvents();
        overlap = new Overlap(referenceView.image, targetView.image);
        if (!overlap.hasOverlap()){
            let errorMsg = "Error: '" + referenceView.fullId + "' and '" + targetView.fullId + "' do not overlap.";
            new MessageBox(errorMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        data.cache.setOverlap(overlap);
        setJoinSizeRange(photometricMosaicDialog.joinSize_Control, data, true);
        setJoinPositionRange(photometricMosaicDialog.joinPosition_Control, data, true);
        console.writeln(getElapsedTime(overlapTime) + "\n");
        processEvents();
    } else {
        overlap = data.cache.overlap;
    }

    // joinRect is the intersection between JoinAreaPreview and the overlap,
    // or the overlapBox if the preview was not specified
    let overlapBox = overlap.overlapBox;
    createPreview(targetView, overlapBox, "Overlap");
    createPreview(referenceView, overlapBox, "Overlap");
    let joinRegion = new JoinRegion(data);
    let joinRect = joinRegion.joinRect;
    if (joinRect === null){
        new MessageBox(joinRegion.errMsg, TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    let isHorizontal = joinRegion.isJoinHorizontal();

    let detectedStars = new StarsDetected(referenceView, targetView);
    detectedStars.detectStars(data.logStarDetection, data.cache);
    processEvents();
    
    if (data.viewFlag === DISPLAY_DETECTED_STARS()){
        console.writeln("\n<b><u>Displaying detected stars</u></b>");
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let tgtBitmap = extractOverlapImage(targetView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let dialog = new DetectedStarsDialog("Photometry Stars", refBitmap, tgtBitmap, 
                detectedStars, data, photometricMosaicDialog);
        dialog.execute();
        return;
    }
    if (data.viewFlag === DISPLAY_PHOTOMETRY_GRAPH()){
        console.writeln("\n<b><u>Displaying photometry graph</u></b>");
        detectedStars.showConsoleInfo = false;
        displayStarGraph(referenceView, targetView, detectedStars, data, photometricMosaicDialog);
        detectedStars.showConsoleInfo = true;
        return;
    }
    if (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        console.writeln("\n<b><u>Displaying overlap gradient graph</u></b>");
    }
    if (data.viewFlag === DISPLAY_TARGET_GRADIENT_GRAPH()) {
        console.writeln("\n<b><u>Displaying target image gradient graph</u></b>");
    }
    
    // Photometry stars
    let colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
    let scaleFactors = [];
    
    // Calculate the scale
    console.writeln("\n<b><u>Calculating scale</u></b>");
    for (let c = 0; c < nChannels; c++){
        let starPairs = colorStarPairs[c];
        let linearFitData = calculateScale(starPairs);
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
    
    let isTargetAfterRef;
    let isAmbiguousFlag = false;
    if (data.useCropTargetToReplaceRegion){
        isTargetAfterRef = null;
    } else if (isHorizontal){
        isTargetAfterRef = isImageBelowOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageBelowOverlap(referenceView.image, overlapBox, nChannels);
        isAmbiguousFlag = (isTargetAfterRef === isRefAfterTarget);
    } else {
        isTargetAfterRef = isImageRightOfOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageRightOfOverlap(referenceView.image, overlapBox, nChannels);
        isAmbiguousFlag = (isTargetAfterRef === isRefAfterTarget);
    }
    if (isAmbiguousFlag){
        // Ambiguous case, let user decide
        let direction = isHorizontal ? "above" : "to the left of";
        let msg = "Reference:\t'" + referenceView.fullId + 
            "'\nTarget:\t'" + targetView.fullId +
            "'\n\nUnable to auto detect tile order. " +
            "One reason this can happen is if the target or reference image is a subset of the other. " +
            "This might be because the target has not been registered to the reference image, " +
            "or the wrong reference or target image has been selected. If this is the case, select 'Abort'." +
            "\n\nIs the reference frame " + direction + " the target frame?";
        let messageBox = new MessageBox(msg,
                "Failed to auto detect tile order", 
                StdIcon_Question, StdButton_Yes, StdButton_No, StdButton_Abort);
        let response = messageBox.execute();
        if (response === StdButton_Abort){
            return;
        }
        isTargetAfterRef = (StdButton_Yes === response);
    }
    
    let overlapThickness = Math.min(overlapBox.height, overlapBox.width);
    let maxSampleSize = Math.floor(overlapThickness/2);
    if (data.sampleSize > maxSampleSize){
        let recommendedSize = Math.floor(overlapThickness/3);
        new MessageBox("Sample Size '" + data.sampleSize + "' is too big for the overlap area.\n" +
                "Sample Size must be less than or equal to " + maxSampleSize +
                "\nReducing sample size to: " + recommendedSize, 
                TITLE(), StdIcon_Warning, StdButton_Ok).execute();
        data.sampleSize = recommendedSize;
        photometricMosaicDialog.sampleSize_Control.setValue(data.sampleSize);  
    }
    
    //targetImage, referenceImage, stars, sampleRect, data
    let sampleGridMap = data.cache.getSampleGridMap(detectedStars.allStars, data, true);
            
    if (data.viewFlag === DISPLAY_GRADIENT_SAMPLES()){
        console.writeln("\n<b><u>Displaying sample grid</u></b>");
        
        let joinPath = createMidJoinPathLimittedByOverlap(targetView.image,
                data.cache.overlap, joinRect, isHorizontal, data);
        let targetSide = createOverlapOutlinePath(targetView.image, 
                data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
        
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let tgtBitmap = extractOverlapImage(targetView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let dialog = new SampleGridDialog("Sample Generation", refBitmap, tgtBitmap, sampleGridMap, detectedStars, 
                data, maxSampleSize, joinPath, targetSide, photometricMosaicDialog);
        dialog.execute();
        return;
    }
    
    let colorSamplePairs = data.cache.getSamplePairs(
            sampleGridMap, scaleFactors, isHorizontal, data, true);
    for (let samplePairs of colorSamplePairs){
        if (samplePairs.length < 3) {
            new MessageBox("Error: Too few samples to create a Surface Spline.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
    }
    
    let binnedColorSamplePairs = [];
    for (let c=0; c<nChannels; c++){
        binnedColorSamplePairs[c] = createBinnedSampleGrid(overlapBox, colorSamplePairs[c], 
                isHorizontal, data.maxSamples);
    }
    
    if (data.viewFlag === DISPLAY_BINNED_SAMPLES()){
        console.writeln("\n<b><u>Displaying binned sample grid</u></b>");
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let dialog = new BinnedSampleGridDialog("Binned Sample Grid", refBitmap, 
                colorSamplePairs[0], isHorizontal, 
                detectedStars, data, photometricMosaicDialog);
        dialog.execute();
        return;
    }

    // Calculate the gradient for each channel
    console.writeln("\n<b><u>Calculating surface spline</u></b>");
    if (binnedColorSamplePairs[0].length < colorSamplePairs[0].length){
        console.writeln("Reduced number of samples from ", colorSamplePairs[0].length, 
                " to ", binnedColorSamplePairs[0].length);
    }
    
    if (data.viewFlag === DISPLAY_MOSAIC_MASK_STARS()){
        console.writeln("\n<b><u>Displaying mosaic mask stars</u></b>");
        let maskArea = data.useMosaicOverlay ? data.cache.overlap.overlapBox : joinRect;
        let dialog = new MaskStarsDialog(maskArea, detectedStars, data,
            binnedColorSamplePairs, isHorizontal, isTargetAfterRef, scaleFactors);
        dialog.execute();
        return;
    }
    
    let propagateSurfaceSplines;
    if (data.useTargetGradientCorrection && data.viewFlag !== DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        let sampleGridMapTarget = data.cache.getSampleGridMap(detectedStars.allStars, data, false);
        let colorSamplePairsTarget = data.cache.getSamplePairs(
            sampleGridMapTarget, scaleFactors, isHorizontal, data, false);
        for (let samplePairs of colorSamplePairsTarget){
            if (samplePairs.length < 3) {
                new MessageBox("Error: Too few samples to create a target Surface Spline.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
                return;
            }
        }
        let binnedColorSamplePairsTarget = [];
        for (let c=0; c<nChannels; c++){
            binnedColorSamplePairsTarget[c] = createBinnedSampleGrid(overlapBox, colorSamplePairsTarget[c], 
                    isHorizontal, data.maxSamples);
        }
        
        propagateSurfaceSplines = [];
        try {
            let smoothness = data.targetGradientSmoothness;
            let consoleInfo = new SurfaceSplineInfo(binnedColorSamplePairsTarget, smoothness, 3);
            propagateSurfaceSplines = getSurfaceSplines(data, binnedColorSamplePairsTarget, smoothness, 3, false);
            consoleInfo.end();
        } catch (ex){
            new MessageBox("Propagate Surface Spline error.\n" + ex.message, 
                    TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        
        if (data.viewFlag === DISPLAY_TARGET_GRADIENT_GRAPH()) {
            // This gradient is important after the edge of the overlap box
            GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                    joinRect, colorSamplePairsTarget, photometricMosaicDialog,
                    data, binnedColorSamplePairsTarget);
            return;
        }
    } else {
        propagateSurfaceSplines = null;
    }
    
    let surfaceSplines = [];
    try {
        let smoothness = data.overlapGradientSmoothness;
        let consoleInfo = new SurfaceSplineInfo(binnedColorSamplePairs, smoothness, 3);
        surfaceSplines = getSurfaceSplines(data, binnedColorSamplePairs, smoothness, 3, true);
        consoleInfo.end();
    } catch (ex){
        new MessageBox("Gradient Surface Spline error.\n" + ex.message, 
                TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }

    if (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        // This gradient is important at the join
        GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                joinRect, colorSamplePairs, photometricMosaicDialog,
                data, binnedColorSamplePairs);
        return;
    }

    console.writeln("\n<b><u>Creating Mosaic</u></b>");

    let imageWindow = createCorrectedView(isHorizontal, isTargetAfterRef,
            scaleFactors, propagateSurfaceSplines, surfaceSplines, true, joinRect, data);
    imageWindow.show();
    imageWindow.zoomToFit();
    
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
    processEvents();
}

/**
 * @param {PhotometricMosaicData} data
 * @param {SamplePair[][]} binnedColorSamplePairs
 * @param {Number} smoothness
 * @param {Number} selectedChannel R=0, G=1, B=2, All=3
 * @param {Boolean} isOverlapSampleGrid
 * @returns {SurfaceSpline[]}
 */
function getSurfaceSplines(data, binnedColorSamplePairs, smoothness, selectedChannel, isOverlapSampleGrid){
    let nChannels = binnedColorSamplePairs.length;
    let surfaceSplines = [];
    for (let c = 0; c < nChannels; c++) {
        if (selectedChannel === c || selectedChannel === 3){
            let samplePairs = binnedColorSamplePairs[c];
            surfaceSplines[c] = data.cache.getSurfaceSpline(
                    data, samplePairs, smoothness, c, isOverlapSampleGrid);
        } else {
            surfaceSplines[c] = null;
        }
    }
    return surfaceSplines;
}

/**
 * @param {SamplePair[][]} binnedColorSamplePairs
 * @param {Number} smoothness
 * @param {Number} selectedChannel
 * @returns {Number}
 */
function SurfaceSplineInfo(binnedColorSamplePairs, smoothness, selectedChannel){
    this.startTime = new Date().getTime();
    let color = ["Red  ", "Green", "Blue ", "RGB  "];
    let nSamples;
    if (selectedChannel < 3){
        nSamples = binnedColorSamplePairs[selectedChannel].length;
    } else {
        nSamples = binnedColorSamplePairs[0].length;
    }
    console.write("Surface spline (", color[selectedChannel], " ", nSamples, " samples, ",
            smoothness.toPrecision(2), " smoothness");
    
    this.end = function (){
        console.writeln(", ", getElapsedTime(this.startTime), ")");
    };
}

/**
 * Appy scale and subtract the detected gradient from the target view
 * @param {Boolean} isHorizontal True if the join is horizontal
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @param {LinearFitData[]} scaleFactors Scale for each color channel.
 * @param {SurfaceSpline[]} propagateSurfaceSplines SurfaceSpline for each color channel, propagated
 * @param {SurfaceSpline[]} surfaceSplines SurfaceSpline for each color channel, tapered
 * @param {Boolean} createMosaicFlag If true, create mosaic. If not, create corrected target image.
 * @param {Rect} joinRect Bounding box of join region (preview extended to overlapBox)
 * @param {PhotometricMosaicData} data
 * @returns {ImageWindow} Cloned image with corrections applied
 */
function createCorrectedView(isHorizontal, isTargetAfterRef, 
        scaleFactors, propagateSurfaceSplines, surfaceSplines, createMosaicFlag, joinRect, data) {
    let applyScaleAndGradientTime = new Date().getTime();
    let refView = data.referenceView;
    let tgtView = data.targetView;
    let overlap = data.cache.overlap;
    
    let width = tgtView.image.width;
    let height = tgtView.image.height;
    let nChannels = scaleFactors.length;
    
    // Create a new view which will become either the mosaic view or the corrected target view
    let viewId = createMosaicFlag ? MOSAIC_NAME() : tgtView.fullId + "_PM";
    let w = tgtView.window;
    let imgWindow = new ImageWindow(width, height, nChannels, w.bitsPerSample, 
            w.isFloatSample, nChannels > 1, viewId);    
    imgWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
    let view = imgWindow.mainView;
    
    if (data.createJoinMask && createMosaicFlag){
        createJoinMask(data, joinRect, view.fullId);
    }
    
    if (createMosaicFlag){
        // Start with the ref image and add then modify it with the target image
        view.image.assign(refView.image);
    } // Leave the image blank for a corrected target view
    
    // Apply scale and gradient to the cloned image
    let tgtCorrector = new ScaleAndGradientApplier(width, height, overlap, joinRect,
            isHorizontal, data, isTargetAfterRef, createMosaicFlag);
    let tgtBox = overlap.tgtBox;                
    for (let channel = 0; channel < nChannels; channel++) {
        let scale = scaleFactors[channel].m;
        let propagateSurfaceSpline = null;
        if (data.useTargetGradientCorrection){
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
    if (createMosaicFlag){
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
    fitsHeaderGradient(keywords, data);
    fitsHeaderOrientation(keywords, isHorizontal, isTargetAfterRef);
    if (createMosaicFlag){
        fitsHeaderJoin(keywords, data, joinRect);
        fitsHeaderMosaic(keywords, data);
    }
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

    // But show the main mosaic view.
    imgWindow.currentView = view;
    imgWindow.zoomToFit();
    
    console.writeln("Created ", view.fullId, " (", getElapsedTime(applyScaleAndGradientTime), ")");
    return imgWindow;
}

/**
 * Create a preview if it does not already exist
 * @param {View} view
 * @param {Rect} rect
 * @param {String} previewName
 */
function createPreview(view, rect, previewName){
    let w = view.window;
    
    let preview = w.previewById(previewName);
    if (!preview.isNull){
        w.modifyPreview(preview, rect, previewName);
        return;
    }
    
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
