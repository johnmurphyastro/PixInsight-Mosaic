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
#include "lib/PhotometricMosaicDialog.js"
#include "lib/SampleGrid.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/Cache.js"
#include "lib/StarLib.js"
#include "lib/Gradient.js"
#include "lib/GradientGraphDialog.js"
#include "lib/FitsHeader.js"
#include "lib/Geometry.js"
#include "lib/PreviewControl.js"
#include "lib/SampleGridDialog.js"
#include "lib/BinnedSampleGridDialog.js"
#include "lib/DetectedStarsDialog.js"
#include "lib/PhotometryStarsDialog.js"
#include "lib/PhotometryGraphDialog.js"
#include "lib/MaskStarsDialog.js"

// To stop my IDE from generating warnings...
function VERSION(){return  "2.3";}
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
function DISPLAY_MOSAIC_MASK_STARS(){return 128;}
function CREATE_JOIN_MASK(){return 256;}
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
    let showJoinDirection = false;
    
    // let the MosaicCache know about any relevant input parameter changes
    // If any of these inputs have changed, the cache will be invalidated
    data.cache.setUserInputData(referenceView.fullId, targetView.fullId, data.logStarDetection);
    
    // Overlap bounding box and overlap bitmap
    if (data.cache.overlap === null){
        showJoinDirection = true;
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
        isHorizontal = isJoinHorizontal(data, intersectRect, showJoinDirection);
        if (data.cropTargetToJoinRegionFlag){
            joinRect = intersectRect;
        } else {
            joinRect = extendSubRect(intersectRect, overlapBox, isHorizontal);
        }
        // Show the join area in a preview
        createPreview(targetView, joinRect, "JoinRegion");
    } else if (data.hasJoinSize){
        isHorizontal = isJoinHorizontal(data, overlapBox, showJoinDirection);
        let halfSize = data.joinSize / 2;
        if (isHorizontal){
            let middle = (overlapBox.y0 + overlapBox.y1) / 2;
            let top = Math.max(overlapBox.y0, Math.round(middle - halfSize));
            let bot = Math.min(overlapBox.y1, Math.round(middle + halfSize));
            joinRect = new Rect(overlapBox.x0, top, overlapBox.x1, bot);
        } else {
            let middle = (overlapBox.x0 + overlapBox.x1) / 2;
            let left = Math.max(overlapBox.x0, Math.round(middle - halfSize));
            let right = Math.min(overlapBox.x1, Math.round(middle + halfSize));
            joinRect = new Rect(left, overlapBox.y0, right, overlapBox.y1);
        }
        createPreview(targetView, joinRect, "JoinRegion");
    } else {
        isHorizontal = isJoinHorizontal(data, overlapBox, showJoinDirection);
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
        console.writeln("\n<b><u>Displaying detected stars</u></b>");
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let tgtBitmap = extractOverlapImage(targetView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let dialog = new DetectedStarsDialog("Detected Stars", refBitmap, tgtBitmap, detectedStars, data);
        dialog.execute();
        return;
    }
    if (data.viewFlag === DISPLAY_PHOTOMETRY_STARS()) {
        console.writeln("\n<b><u>Displaying photometry stars</u></b>");
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let tgtBitmap = extractOverlapImage(targetView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        detectedStars.showConsoleInfo = false;
        let dialog = new PhotometryStarsDialog("Photometry Stars", refBitmap, tgtBitmap, nChannels, 
                detectedStars, data, photometricMosaicDialog);
        dialog.execute();
        detectedStars.showConsoleInfo = true;
        return;
    }
    if (data.viewFlag === DISPLAY_PHOTOMETRY_GRAPH()){
        console.writeln("\n<b><u>Displaying photometry graph</u></b>");
        detectedStars.showConsoleInfo = false;
        displayStarGraph(referenceView, targetView, detectedStars, data, photometricMosaicDialog);
        detectedStars.showConsoleInfo = true;
        return;
    }
    if (data.viewFlag === DISPLAY_MOSAIC_MASK_STARS()){
        console.writeln("\n<b><u>Displaying mosaic mask stars</u></b>");
        let dialog = new MaskStarsDialog(referenceView, targetView, joinRect, 
                detectedStars, data, photometricMosaicDialog);
        dialog.execute();
        return;
    }
    if (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        console.writeln("\n<b><u>Displaying gradient graph</u></b>");
    }
    if (data.viewFlag === DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH()) {
        console.writeln("\n<b><u>Displaying extrapolated gradient graph</u></b>");
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
    let sampleGridMap = data.cache.getSampleGridMap(targetView.image, referenceView.image,
            detectedStars.allStars, overlapBox, data);
            
    if (data.viewFlag === DISPLAY_GRADIENT_SAMPLES()){
        console.writeln("\n<b><u>Displaying sample grid</u></b>");
        let overlap = data.cache.overlap;
        let refBitmap = extractOverlapImage(referenceView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let tgtBitmap = extractOverlapImage(targetView, overlap.overlapBox, overlap.getOverlapMaskBuffer());
        let dialog = new SampleGridDialog("SampleGrid", refBitmap, tgtBitmap, sampleGridMap, detectedStars, 
                data, maxSampleSize, photometricMosaicDialog);
        dialog.execute();
        return;
    }
    
    let colorSamplePairs = data.cache.getSamplePairs(
            sampleGridMap, targetView.image, referenceView.image, scaleFactors, isHorizontal, data);
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

    let isTargetAfterRef;
    if (data.cropTargetToJoinRegionFlag){
        isTargetAfterRef = null;
    } else if (isHorizontal){
        isTargetAfterRef = isImageBelowOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageBelowOverlap(referenceView.image, overlapBox, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let msg = "Reference:\t'" + referenceView.fullId + 
                    "'\nTarget:\t'" + targetView.fullId +
                    "'\n\nIs the reference frame above the target frame?";
            let messageBox = new MessageBox(msg,
                    "Failed to auto detect tile order", 
                    StdIcon_Question, StdButton_Yes, StdButton_No, StdButton_Abort);
            let response = messageBox.execute();
            if (response === StdButton_Abort){
                return;
            }
            isTargetAfterRef = (StdButton_Yes === response);
        }
    } else {
        isTargetAfterRef = isImageRightOfOverlap(targetView.image, overlapBox, nChannels);
        let isRefAfterTarget = isImageRightOfOverlap(referenceView.image, overlapBox, nChannels);
        if (isTargetAfterRef === isRefAfterTarget){
            // Ambiguous case, let user decide
            let msg = "Reference:\t'" + referenceView.fullId + 
                    "'\nTarget:\t'" + targetView.fullId +
                    "'\n\nIs the reference frame to the left of the target frame?";
            let messageBox = new MessageBox(msg,
                    "Failed to auto detect tile order", 
                    StdIcon_Question, StdButton_Yes, StdButton_No, StdButton_Abort);
            let response = messageBox.execute();
            if (response === StdButton_Abort){
                return;
            }
            isTargetAfterRef = (StdButton_Yes === response);
        }
    }

    // Calculate the gradient for each channel
    console.writeln("\n<b><u>Calculating surface spline</u></b>");
    if (binnedColorSamplePairs[0].length < colorSamplePairs[0].length){
        console.writeln("Reduced number of samples from ", colorSamplePairs[0].length, 
                " to ", binnedColorSamplePairs[0].length);
    }
    let createSurfaceSplineTime = new Date().getTime();
    let propagateSurfaceSplines;
    if (data.extrapolatedGradientFlag && data.viewFlag !== DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        propagateSurfaceSplines = [];
        try {
            for (let c = 0; c < nChannels; c++) {
                let samplePairs = binnedColorSamplePairs[c];
                propagateSurfaceSplines[c] = data.cache.getSurfaceSpline(
                        data, samplePairs, data.extrapolatedGradientSmoothness, c);
            }
        } catch (ex){
            new MessageBox("Propagate Surface Spline error.\n" + ex.message, 
                    TITLE(), StdIcon_Error, StdButton_Ok).execute();
            return;
        }
        
        if (data.viewFlag === DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH()) {
            console.writeln(binnedColorSamplePairs[0].length,
                    " samples, ", getElapsedTime(createSurfaceSplineTime));
            // This gradient is important after the edge of the overlap box
            GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                    propagateSurfaceSplines, joinRect, binnedColorSamplePairs, data, true);
            return;
        }
    } else {
        propagateSurfaceSplines = null;
    }
    
    let surfaceSplines = [];
    try {
        for (let c = 0; c < nChannels; c++) {
            let samplePairs = binnedColorSamplePairs[c];
            surfaceSplines[c] = data.cache.getSurfaceSpline(
                    data, samplePairs, data.overlapGradientSmoothness, c);
        }
    } catch (ex){
        new MessageBox("Gradient Surface Spline error.\n" + ex.message, 
                TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }
    console.writeln(binnedColorSamplePairs[0].length,
            " samples, ", getElapsedTime(createSurfaceSplineTime));

    if (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH()) {
        // This gradient is important at the join
        GradientGraph(targetView.image, isHorizontal, isTargetAfterRef,
                surfaceSplines, joinRect, binnedColorSamplePairs, data, false);
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
 * Appy scale and subtract the detected gradient from the target view
 * @param {View} refView Used to create mosaic. Read only.
 * @param {View} tgtView Used to create mosaic or to create corrected tgtView clone. Read only.
 * @param {Boolean} isHorizontal True if the join is horizontal
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @param {LinearFitData[]} scaleFactors Scale for each color channel.
 * @param {SurfaceSpline[]} propagateSurfaceSplines SurfaceSpline for each color channel, propagated
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
        imgWindow.createPreview(joinRect, "JoinRegion");
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
 * @param {Boolean} showConsoleInfo 
 * @returns {Boolean} True if the mosaic join is mostly horizontal
 */
function isJoinHorizontal(data, joinRect, showConsoleInfo){
    let isHorizontal = joinRect.width > joinRect.height;
    if (showConsoleInfo){
        if (data.cropTargetToJoinRegionFlag){
            console.writeln("<b>Mode: Crop target image to Join Region</b>");
        } else if (isHorizontal) {
            console.writeln("<b>Horizontal join</b>");
        } else {
            console.writeln("<b>Vertical join</b>");
        }
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
