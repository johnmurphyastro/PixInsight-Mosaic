/* global ImageWindow, Parameters, View, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok, Dialog, StdButton_Yes, StdIcon_Question, StdButton_No, StdButton_Cancel, Settings, DataType_Float, KEYPREFIX, DataType_Int32, DataType_Boolean, StdButton_Abort, StdIcon_Warning, StdButton_Ignore, APERTURE_GROWTH, APERTURE_ADD, APERTURE_BKG_DELTA */
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
//"use strict";
#include <pjsr/DataType.jsh>
#include "DialogLib.js"
#include "STFAutoStretch.js"
#define KEYPREFIX "PhotometricMosaic"
#define APERTURE_ADD 1
#define APERTURE_GROWTH 0.5
#define APERTURE_BKG_DELTA 10

function EXTRA_CONTROLS(){return false;}
/**
 * Default the Reference view to a view that contains "Mosaic" in its name, but
 * doesn't start with "PM_" (e.g. graph windows).
 * If there is more than one "Mosaic" view, sort them and take the last one.
 * If there are no "Mosaic" views yet, return a view that doesn't start with
 * "PM_" and is not the active window.
 * @return {View} default reference view
 */
function getDefaultReferenceView() {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let mosaicWindows = [];
    for (let win of allWindows) {
        if (!win.mainView.fullId.startsWith(WINDOW_ID_PREFIX()) &&
                win.mainView.fullId.toLowerCase().contains("mosaic")){
            mosaicWindows.push(win.mainView.fullId);
        }
    }
    if (mosaicWindows.length > 0){
        mosaicWindows.sort();
        return View.viewById( mosaicWindows[mosaicWindows.length - 1] );
    }
    for (let win of allWindows) {
        if (!win.mainView.fullId.startsWith(WINDOW_ID_PREFIX()) &&
                win !== ImageWindow.activeWindow){
            return win.mainView;
        }
    }
    return null;
}

/**
 * Default the target view to the current view provided it is not a graph/sample
 * window (starting with "PM__") and not the reference view.
 * Otherwise, return the first view that is not the reference view and is not
 * a graph/sample view. If all fails, return null
 * @param {View} referenceView
 * @returns {View} default target view
 */
function getDefaultTargetView(referenceView){
    function isGoodChoice(view){
        return !view.fullId.startsWith(WINDOW_ID_PREFIX()) &&
        (referenceView === null || referenceView.fullId !== view.fullId);
    };
    if (isGoodChoice(ImageWindow.activeWindow.mainView)){
        return ImageWindow.activeWindow.mainView;
    }
    let allWindows = ImageWindow.openWindows;
    for (let win of allWindows) {
        if (isGoodChoice(win.mainView)){
            return win.mainView;
        }
    }
    return null;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function PhotometricMosaicData() {
    // Used to populate the contents of a saved process icon
    // Also used at the end of our script to populate the history entry.
    this.saveParameters = function () {
        if (this.referenceView.isMainView) {
            Parameters.set("referenceView", this.referenceView.fullId);
        }
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
          
        // Star Detection
        Parameters.set("starDetection", this.logStarDetection);
        
        // Photometric Star Search
        Parameters.set("starFluxTolerance", this.starFluxTolerance);
        Parameters.set("starSearchRadius", this.starSearchRadius);
        
        // Photometric Scale
        Parameters.set("apertureGrowthRate", this.apertureGrowthRate);
        Parameters.set("apertureGrowthLimit", this.apertureGrowthLimit);
        Parameters.set("apertureAdd", this.apertureAdd);
        Parameters.set("apertureBgDelta", this.apertureBgDelta);
        Parameters.set("limitPhotoStarsPercent", this.limitPhotoStarsPercent);
        Parameters.set("linearRange", this.linearRange);
        Parameters.set("outlierRemoval", this.outlierRemoval);
        Parameters.set("useAutoPhotometry", this.useAutoPhotometry);
        
        // Join Region
        Parameters.set("joinSize", this.joinSize);
        Parameters.set("joinPosition", this.joinPosition);
        
        // Replace/Update Region
        Parameters.set("cropTargetPreviewLeft", this.cropTargetPreviewRect.x0);
        Parameters.set("cropTargetPreviewTop", this.cropTargetPreviewRect.y0);
        Parameters.set("cropTargetPreviewWidth", this.cropTargetPreviewRect.width);
        Parameters.set("cropTargetPreviewHeight", this.cropTargetPreviewRect.height);
        Parameters.set("useCropTargetToReplaceRegion", this.useCropTargetToReplaceRegion);
        
        // Gradient Sample Generation
        Parameters.set("sampleStarGrowthRate", this.sampleStarGrowthRate);
        Parameters.set("sampleStarGrowthLimit", this.sampleStarGrowthLimit);
        Parameters.set("sampleStarGrowthLimitTarget", this.sampleStarGrowthLimitTarget);
        Parameters.set("sampleStarGrowthRateTarget", this.sampleStarGrowthRateTarget);
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("maxSamples", this.maxSamples);
        Parameters.set("useAutoSampleGeneration", this.useAutoSampleGeneration);
        
        // Gradient Correction (Overlap region)
        Parameters.set("overlapGradientSmoothness", this.overlapGradientSmoothness);
        Parameters.set("taperLength", this.taperLength);
        Parameters.set("useAutoTaperLength", this.useAutoTaperLength);
        
        // Gradient Correction (Target image)
        Parameters.set("useTargetGradientCorrection", this.useTargetGradientCorrection);
        Parameters.set("targetGradientSmoothness", this.targetGradientSmoothness);
        
        // Mosaic Star Mask
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("maskStarGrowthRate", this.maskStarGrowthRate);
        Parameters.set("maskStarGrowthLimit", this.maskStarGrowthLimit);
        Parameters.set("maskStarRadiusAdd", this.maskStarRadiusAdd);
        Parameters.set("useAutoMaskStarSize", this.useAutoMaskStarSize);
        
        // Mosaic Join Mode
        Parameters.set("useMosaicOverlay", this.useMosaicOverlay);
        Parameters.set("useMosaicRandom", this.useMosaicRandom);
        Parameters.set("useMosaicAverage", this.useMosaicAverage);
        Parameters.set("createJoinMask", this.createJoinMask);
        
        Parameters.set("graphWidth", this.graphWidth);
        Parameters.set("graphHeight", this.graphHeight);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId);
        }
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId);
        }
        
        // Star Detection
        if (Parameters.has("starDetection"))
            this.logStarDetection = Parameters.getReal("starDetection");
        
        // Photometric Star Search
        if (Parameters.has("starFluxTolerance"))
            this.starFluxTolerance = Parameters.getReal("starFluxTolerance");
        if (Parameters.has("starSearchRadius"))
            this.starSearchRadius = Parameters.getReal("starSearchRadius");
        
        // Photometric Scale
        if (Parameters.has("apertureGrowthRate"))
            this.apertureGrowthRate = Parameters.getReal("apertureGrowthRate");
        if (Parameters.has("apertureGrowthLimit"))
            this.apertureGrowthLimit = Parameters.getInteger("apertureGrowthLimit");
        if (Parameters.has("apertureAdd"))
            this.apertureAdd = Parameters.getInteger("apertureAdd");
        if (Parameters.has("apertureBgDelta"))
            this.apertureBgDelta = Parameters.getInteger("apertureBgDelta");
        if (Parameters.has("limitPhotoStarsPercent"))
            this.limitPhotoStarsPercent = Parameters.getReal("limitPhotoStarsPercent");
        if (Parameters.has("linearRange"))
            this.linearRange = Parameters.getReal("linearRange");
        if (Parameters.has("outlierRemoval"))
            this.outlierRemoval = Parameters.getInteger("outlierRemoval");
        if (Parameters.has("useAutoPhotometry"))
            this.useAutoPhotometry = Parameters.getBoolean("useAutoPhotometry");
        
        // Join Region
        if (Parameters.has("joinSize"))
            this.joinSize = Parameters.getInteger("joinSize");
        if (Parameters.has("joinPosition"))
            this.joinPosition = Parameters.getInteger("joinPosition");  
        
        // Replace/Update Region
        {
            let x = 0;
            let y = 0;
            let w = 1;
            let h = 1;
            if (Parameters.has("cropTargetPreviewLeft")){
                x = Parameters.getInteger("cropTargetPreviewLeft");
            }
            if (Parameters.has("cropTargetPreviewTop")){
                y = Parameters.getInteger("cropTargetPreviewTop");
            }
            if (Parameters.has("cropTargetPreviewWidth")){
                w = Parameters.getInteger("cropTargetPreviewWidth");
            }
            if (Parameters.has("cropTargetPreviewHeight")){
                h = Parameters.getInteger("cropTargetPreviewHeight");
            }
            this.cropTargetPreviewRect = new Rect(x, y, x + w, y + h);
            
            if (Parameters.has("useCropTargetToReplaceRegion"))
                this.useCropTargetToReplaceRegion = Parameters.getBoolean("useCropTargetToReplaceRegion");
        }
        
        // Gradient Sample Generation
        if (Parameters.has("sampleStarGrowthRate"))
            this.sampleStarGrowthRate = Parameters.getReal("sampleStarGrowthRate");
        if (Parameters.has("sampleStarGrowthLimit"))
            this.sampleStarGrowthLimit = Parameters.getInteger("sampleStarGrowthLimit");
        if (Parameters.has("sampleStarGrowthLimitTarget"))
            this.sampleStarGrowthLimitTarget = Parameters.getInteger("sampleStarGrowthLimitTarget");
        if (Parameters.has("sampleStarGrowthRateTarget"))
            this.sampleStarGrowthRateTarget = Parameters.getReal("sampleStarGrowthRateTarget");
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getReal("limitSampleStarsPercent");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("maxSamples"))
            this.maxSamples = Parameters.getInteger("maxSamples");
        if (Parameters.has("useAutoSampleGeneration"))
            this.useAutoSampleGeneration = Parameters.getBoolean("useAutoSampleGeneration");
        
        // Gradient Correction (Overlap region)
        if (Parameters.has("overlapGradientSmoothness"))
            this.overlapGradientSmoothness = Parameters.getReal("overlapGradientSmoothness");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
        if (Parameters.has("useAutoTaperLength"))
            this.useAutoTaperLength = Parameters.getBoolean("useAutoTaperLength");
        
        // Gradient Correction (Target image)
        if (Parameters.has("useTargetGradientCorrection"))
            this.useTargetGradientCorrection = Parameters.getBoolean("useTargetGradientCorrection");
        if (Parameters.has("targetGradientSmoothness"))
            this.targetGradientSmoothness = Parameters.getReal("targetGradientSmoothness");
        
        // Mosaic Star Mask
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getReal("limitMaskStarsPercent");
        if (Parameters.has("maskStarGrowthRate"))
            this.maskStarGrowthRate = Parameters.getReal("maskStarGrowthRate");
        if (Parameters.has("maskStarGrowthLimit"))
            this.maskStarGrowthLimit = Parameters.getInteger("maskStarGrowthLimit");
        if (Parameters.has("maskStarRadiusAdd"))
            this.maskStarRadiusAdd = Parameters.getReal("maskStarRadiusAdd");
        if (Parameters.has("useAutoMaskStarSize"))
            this.useAutoMaskStarSize = Parameters.getBoolean("useAutoMaskStarSize");
        
        // Mosaic Join Mode
        if (Parameters.has("useMosaicOverlay"))
            this.useMosaicOverlay = Parameters.getBoolean("useMosaicOverlay");
        if (Parameters.has("useMosaicRandom"))
            this.useMosaicRandom = Parameters.getBoolean("useMosaicRandom");
        if (Parameters.has("useMosaicAverage"))
            this.useMosaicAverage = Parameters.getBoolean("useMosaicAverage");
        if (Parameters.has("createJoinMask"))
            this.createJoinMask = Parameters.getBoolean("createJoinMask");
        
        if (Parameters.has("graphWidth"))
            this.graphWidth = Parameters.getInteger("graphWidth");
        if (Parameters.has("graphHeight"))
            this.graphHeight = Parameters.getInteger("graphHeight");
    };

    // Initialise the scripts data
    this.setParameters = function () {
        // Star Detection
        this.logStarDetection = -1;
        
        // Photometric Star Search
        this.starFluxTolerance = 1.5;
        this.starSearchRadius = 2.5;
        
        // Photometric Scale
        this.apertureGrowthRate = APERTURE_GROWTH;
        this.apertureGrowthLimit = 300;
        this.apertureAdd = APERTURE_ADD;
        this.apertureBgDelta = APERTURE_BKG_DELTA;
        this.limitPhotoStarsPercent = 100;
        this.linearRange = 0.5;
        this.outlierRemoval = 0;
        this.useAutoPhotometry = true;
        
        // Join Region
        this.joinSize = 20;
        this.joinPosition = 0;
        
        // Replace/Update Region
        this.cropTargetPreviewRect = new Rect(0, 0, 1, 1);
        this.useCropTargetToReplaceRegion = false;
        
        // Gradient Sample Generation
        this.sampleStarGrowthRate = APERTURE_GROWTH;
        this.sampleStarGrowthLimit = 10;
        this.sampleStarGrowthLimitTarget = 100;
        this.sampleStarGrowthRateTarget = 0.5;
        this.limitSampleStarsPercent = 35;
        this.sampleSize = 20;
        this.maxSamples = 3000;
        this.useAutoSampleGeneration = true;
        
        // Gradient Correction (Overlap region)
        this.overlapGradientSmoothness = -1;
        this.taperLength = 200;
        this.useAutoTaperLength = true;
        
        // Gradient Correction (Target image)
        this.useTargetGradientCorrection = true;
        this.targetGradientSmoothness = 2;
        
        // Mosaic Star Mask
        this.limitMaskStarsPercent = 10;
        this.maskStarGrowthRate = 1.0;
        this.maskStarGrowthLimit = 150;
        this.maskStarRadiusAdd = 5;
        this.useAutoMaskStarSize = true;
        
        // Mosaic Join Mode
        this.useMosaicOverlay = true;
        this.useMosaicRandom = false;
        this.useMosaicAverage = false;
        this.createJoinMask = true;
        
        this.graphWidth = 1200; // gradient and photometry graph width
        this.graphHeight = 800; // gradient and photometry graph height
        
        if (this.cache !== undefined){
            this.cache.invalidate();
        }
        this.cache = new MosaicCache();
        
    };

    // Used when the user presses the reset button
    this.resetParameters = function (photometricMosaicDialog) {
        // Reset the script's data
        this.setParameters();
        
        // Star Detection
        photometricMosaicDialog.logStarDetection_Control.setValue(this.logStarDetection);
        
        // Photometric Star Search
        photometricMosaicDialog.starFluxTolerance_Control.setValue(this.starFluxTolerance);
        photometricMosaicDialog.starSearchRadius_Control.setValue(this.starSearchRadius);
        
        // Photometric Scale
        photometricMosaicDialog.apertureGrowthRate_Control.setValue(this.apertureGrowthRate);
        photometricMosaicDialog.apertureAdd_Control.setValue(this.apertureAdd);
        photometricMosaicDialog.apertureBgDelta_Control.setValue(this.apertureBgDelta);
        photometricMosaicDialog.limitPhotoStarsPercent_Control.setValue(this.limitPhotoStarsPercent);
        photometricMosaicDialog.linearRange_Control.setValue(this.linearRange);
        photometricMosaicDialog.outlierRemoval_Control.setValue(this.outlierRemoval);
        photometricMosaicDialog.setPhotometryAutoValues(this.useAutoPhotometry);
        if (EXTRA_CONTROLS())
            photometricMosaicDialog.apertureGrowthLimit_Control.setValue(this.apertureGrowthLimit);
        
        // Mosaic Join Mode
        photometricMosaicDialog.mosaicOverlay_Control.checked = this.useMosaicOverlay;
        photometricMosaicDialog.mosaicRandom_Control.checked = this.useMosaicRandom;
        photometricMosaicDialog.mosaicAverage_Control.checked = this.useMosaicAverage;
        photometricMosaicDialog.joinMask_CheckBox.checked = this.createJoinMask;
        
        // Join Region
        photometricMosaicDialog.joinSize_Control.setValue(this.joinSize);
        photometricMosaicDialog.joinPosition_Control.setValue(this.joinPosition);
        
        // Replace/Update Region
        photometricMosaicDialog.rectangleX0_Control.setValue(this.cropTargetPreviewRect.x0);
        photometricMosaicDialog.rectangleY0_Control.setValue(this.cropTargetPreviewRect.y0);
        photometricMosaicDialog.rectangleWidth_Control.setValue(this.cropTargetPreviewRect.width);
        photometricMosaicDialog.rectangleHeight_Control.setValue(this.cropTargetPreviewRect.height);
        photometricMosaicDialog.setUseCropTargetToReplaceRegion(this.useCropTargetToReplaceRegion);
        
        // Gradient Sample Generation
        photometricMosaicDialog.sampleStarGrowthRate_Control.setValue(this.sampleStarGrowthRate);
        photometricMosaicDialog.sampleStarGrowthLimit_Control.setValue(this.sampleStarGrowthLimit);
        photometricMosaicDialog.sampleStarGrowthLimitTarget_Control.setValue(this.sampleStarGrowthLimitTarget);
        photometricMosaicDialog.sampleStarGrowthRateTarget_Control.setValue(this.sampleStarGrowthRateTarget);
        photometricMosaicDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        photometricMosaicDialog.sampleSize_Control.setValue(this.sampleSize);
        if (EXTRA_CONTROLS()){
            photometricMosaicDialog.maxSamples_Control.setValue(this.maxSamples);
        }
        photometricMosaicDialog.setSampleGenerationAutoValues(this.useAutoSampleGeneration);
        
        // Gradient Correction (Overlap region)
        photometricMosaicDialog.overlapGradientSmoothness_Control.setValue(this.overlapGradientSmoothness);
        photometricMosaicDialog.taperLength_Control.setValue(this.taperLength);
        photometricMosaicDialog.autoTaperLengthCheckBox.checked = this.useAutoTaperLength;
        photometricMosaicDialog.setTaperLengthAutoValue(this);
        
        // Gradient Correction (Target image)
        photometricMosaicDialog.targetGradientSmoothness_Control.setValue(this.targetGradientSmoothness);
        photometricMosaicDialog.setTargetGradientFlag(this.useTargetGradientCorrection);
    };
    
    // Initialise the script's data
    this.setParameters();
    this.referenceView = getDefaultReferenceView();
    this.targetView = getDefaultTargetView(this.referenceView);
}

/**
 * Save all script parameters as settings keys.
 * @param {PhotometricMosaicData} data 
 */
function saveSettings(data){
    // Star Detection
    Settings.write( KEYPREFIX+"/starDetection", DataType_Float, data.logStarDetection );
    
        // Photometric Star Search
    Settings.write( KEYPREFIX+"/starFluxTolerance", DataType_Float, data.starFluxTolerance );
    Settings.write( KEYPREFIX+"/starSearchRadius", DataType_Float, data.starSearchRadius );

    // Photometric Scale
    Settings.write( KEYPREFIX+"/apertureGrowthRate", DataType_Float, data.apertureGrowthRate );
    Settings.write( KEYPREFIX+"/apertureGrowthLimit", DataType_Int32, data.apertureGrowthLimit );
    Settings.write( KEYPREFIX+"/apertureAdd", DataType_Int32, data.apertureAdd );
    Settings.write( KEYPREFIX+"/apertureBgDelta", DataType_Int32, data.apertureBgDelta );
    Settings.write( KEYPREFIX+"/limitPhotoStarsPercent", DataType_Float, data.limitPhotoStarsPercent );
    Settings.write( KEYPREFIX+"/linearRange", DataType_Float, data.linearRange );
    Settings.write( KEYPREFIX+"/outlierRemoval", DataType_Int32, data.outlierRemoval );
    Settings.write( KEYPREFIX+"/useAutoPhotometry", DataType_Boolean, data.useAutoPhotometry );

    // Join Region
    Settings.write( KEYPREFIX+"/joinSize", DataType_Int32, data.joinSize );
    
    // Gradient Sample Generation
    Settings.write( KEYPREFIX+"/sampleStarGrowthRate", DataType_Float, data.sampleStarGrowthRate );
    Settings.write( KEYPREFIX+"/sampleStarGrowthLimit", DataType_Int32, data.sampleStarGrowthLimit );
    Settings.write( KEYPREFIX+"/sampleStarGrowthLimitTarget", DataType_Int32, data.sampleStarGrowthLimitTarget );
    Settings.write( KEYPREFIX+"/sampleStarGrowthRateTarget", DataType_Float, data.sampleStarGrowthRateTarget );
    Settings.write( KEYPREFIX+"/limitSampleStarsPercent", DataType_Float, data.limitSampleStarsPercent );
    Settings.write( KEYPREFIX+"/sampleSize", DataType_Int32, data.sampleSize );
    if (EXTRA_CONTROLS()){
        Settings.write( KEYPREFIX+"/maxSamples", DataType_Int32, data.maxSamples );
    }
    Settings.write( KEYPREFIX+"/useAutoSampleGeneration", DataType_Boolean, data.useAutoSampleGeneration );
    
    // Gradient Correction (Overlap region)
    Settings.write( KEYPREFIX+"/overlapGradientSmoothness", DataType_Float, data.overlapGradientSmoothness );
    Settings.write( KEYPREFIX+"/taperLength", DataType_Int32, data.taperLength );
    Settings.write( KEYPREFIX+"/useAutoTaperLength", DataType_Boolean, data.useAutoTaperLength );
    
    // Gradient Correction (Target image)
    Settings.write( KEYPREFIX+"/useTargetGradientCorrection", DataType_Boolean, data.useTargetGradientCorrection );
    Settings.write( KEYPREFIX+"/targetGradientSmoothness", DataType_Float, data.targetGradientSmoothness );
    
    // Mosaic Star Mask
    Settings.write( KEYPREFIX+"/limitMaskStarsPercent", DataType_Float, data.limitMaskStarsPercent );
    Settings.write( KEYPREFIX+"/maskStarGrowthRate", DataType_Float, data.maskStarGrowthRate );
    Settings.write( KEYPREFIX+"/maskStarGrowthLimit", DataType_Int32, data.maskStarGrowthLimit );
    Settings.write( KEYPREFIX+"/maskStarRadiusAdd", DataType_Float, data.maskStarRadiusAdd );
    Settings.write( KEYPREFIX+"/useAutoMaskStarSize", DataType_Boolean, data.useAutoMaskStarSize );
    
    // Mosaic Join Mode
    Settings.write( KEYPREFIX+"/useMosaicOverlay", DataType_Boolean, data.useMosaicOverlay );
    Settings.write( KEYPREFIX+"/useMosaicRandom", DataType_Boolean, data.useMosaicRandom );
    Settings.write( KEYPREFIX+"/useMosaicAverage", DataType_Boolean, data.useMosaicAverage );
    Settings.write( KEYPREFIX+"/createJoinMask", DataType_Boolean, data.createJoinMask );
    
    Settings.write( KEYPREFIX+"/graphWidth", DataType_Int32, data.graphWidth );
    Settings.write( KEYPREFIX+"/graphHeight", DataType_Int32, data.graphHeight );
    
    console.writeln("\nSaved settings");
}

// A function to delete all previously stored settings keys for this script.
function resetSettings(){
   Settings.remove( KEYPREFIX );
}

/**
 * Restore all script parameters from settings keys.
 * @param {PhotometricMosaicData} data 
 */
function restoreSettings(data){
    var keyValue;
    // Star Detection
    keyValue = Settings.read( KEYPREFIX+"/starDetection", DataType_Float );
    if ( Settings.lastReadOK )
        data.logStarDetection = keyValue;
    
    // Photometric Star Search
    keyValue = Settings.read( KEYPREFIX+"/starFluxTolerance", DataType_Float );
    if ( Settings.lastReadOK )
        data.starFluxTolerance = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/starSearchRadius", DataType_Float );
    if ( Settings.lastReadOK )
        data.starSearchRadius;
    
    // Photometric Scale
    keyValue = Settings.read( KEYPREFIX+"/apertureGrowthRate", DataType_Float );
    if ( Settings.lastReadOK )
        data.apertureGrowthRate = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/apertureGrowthLimit", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.apertureGrowthLimit = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/apertureAdd", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.apertureAdd = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/apertureBgDelta", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.apertureBgDelta = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/limitPhotoStarsPercent", DataType_Float );
    if ( Settings.lastReadOK )
        data.limitPhotoStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/linearRange", DataType_Float );
    if ( Settings.lastReadOK )
        data.linearRange = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/outlierRemoval", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.outlierRemoval = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/useAutoPhotometry", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useAutoPhotometry = keyValue;
    
    // Join Region
    keyValue = Settings.read( KEYPREFIX+"/joinSize", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.joinSize = keyValue;

    // Gradient Sample Generation
    keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthRate", DataType_Float );
    if ( Settings.lastReadOK )
        data.sampleStarGrowthRate = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthLimit", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.sampleStarGrowthLimit = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthLimitTarget", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.sampleStarGrowthLimitTarget = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthRateTarget", DataType_Float );
    if ( Settings.lastReadOK )
        data.sampleStarGrowthRateTarget = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/limitSampleStarsPercent", DataType_Float );
    if ( Settings.lastReadOK )
        data.limitSampleStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleSize", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.sampleSize = keyValue;
    if (EXTRA_CONTROLS()){
        keyValue = Settings.read( KEYPREFIX+"/maxSamples", DataType_Int32 );
        if ( Settings.lastReadOK )
            data.maxSamples = keyValue;
    }
    keyValue = Settings.read( KEYPREFIX+"/useAutoSampleGeneration", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useAutoSampleGeneration = keyValue;
    
    // Gradient Correction (Overlap region)
    keyValue = Settings.read( KEYPREFIX+"/overlapGradientSmoothness", DataType_Float );
    if ( Settings.lastReadOK )
        data.overlapGradientSmoothness = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/taperLength", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.taperLength = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/useAutoTaperLength", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useAutoTaperLength = keyValue;
    
    // Gradient Correction (Target image)
    keyValue = Settings.read( KEYPREFIX+"/useTargetGradientCorrection", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useTargetGradientCorrection = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/targetGradientSmoothness", DataType_Float );
    if ( Settings.lastReadOK )
        data.targetGradientSmoothness = keyValue;
    
    // Mosaic Star Mask
    keyValue = Settings.read( KEYPREFIX+"/limitMaskStarsPercent", DataType_Float );
    if ( Settings.lastReadOK )
        data.limitMaskStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/maskStarGrowthRate", DataType_Float );
    if ( Settings.lastReadOK )
        data.maskStarGrowthRate = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/maskStarGrowthLimit", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.maskStarGrowthLimit = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/maskStarRadiusAdd", DataType_Float );
    if ( Settings.lastReadOK )
        data.maskStarRadiusAdd = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/useAutoMaskStarSize", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useAutoMaskStarSize = keyValue;
    
    // Mosaic Join Mode
    keyValue = Settings.read( KEYPREFIX+"/useMosaicOverlay", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useMosaicOverlay = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/useMosaicRandom", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useMosaicRandom = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/useMosaicAverage", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.useMosaicAverage = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/createJoinMask", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.createJoinMask = keyValue;
    
    keyValue = Settings.read( KEYPREFIX+"/graphWidth", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.graphWidth = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/graphHeight", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.graphHeight = keyValue;
}

// The main dialog function
function PhotometricMosaicDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    let self = this;
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            this.dialog.setVariableSize();
        } else {
//            bar.updateSection();
            this.dialog.setFixedSize();
        }
    };
    
    // =======================================
    // SectionBar: "Quick Start Guide"
    // =======================================
    // Create the Program Description at the top
    let titleLabel = createTitleLabel(
        "<b>Combines registered linear images. " +
        "Gradient and scale corrections are applied. " +
        "Designed to work with planned mosaics where the tiles form a regular grid.</b><br />" +
        "(1) Read help sections: <i>Prerequisites</i> and <i>Quick Start Guide</i>.<br />" +
        "(2) Use script <i>Image Analysis -> ImageSolver</i> to plate solve your stacked mosaic tiles.<br />" +
        "(3) Use script <i>Utilities -> MosaicByCoordinates</i> to register the plate solved tiles.<br />" +
        "(4) Use script <i>Mosaic -> TrimMosaicTile</i> to erode away soft or ragged image edges.<br />" +
        "(5) Join frames into either rows or columns, and then join these strips to create the final mosaic.<br />" +
        "Copyright &copy; 2019-2020 John Murphy");
    let titleSection = new Control(this);
    titleSection.sizer = new VerticalSizer;
    titleSection.sizer.add(titleLabel);
    titleSection.setMinSize(650, 60);
    let titleBar = new SectionBar(this, "Photometric Mosaic V" + VERSION());
    titleBar.setSection(titleSection);
    titleBar.onToggleSection = this.onToggleSection;
    // SectionBar "Quick Start Guide" End

    // =======================================
    // SectionBar: "Reference & Target Views"
    // =======================================
    let REFERENCE_VIEW_STR_LEN = this.font.width("Reference view:");
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference view:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = REFERENCE_VIEW_STR_LEN;
    referenceImage_Label.toolTip = "<p>The reference image. This image will not be modified.</p>";

    let referenceImage_ViewList = new ViewList(this);
    referenceImage_ViewList.getMainViews();
    referenceImage_ViewList.minWidth = 470;
    if (data.referenceView !== null){
        referenceImage_ViewList.currentView = data.referenceView;
    }
    referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };
    let referenceAutoStf_button = new PushButton(this);
    referenceAutoStf_button.text = "Auto STF";
    referenceAutoStf_button.toolTip =
            "<p>Apply an auto ScreenTransferFunction to the reference image.</p>" +
            "<p>The dialogs that display image data from the reference image " +
            "rely on its STF to display the images correctly.</p>";
    referenceAutoStf_button.onClick = function () {
        STFAutoStretch(data.referenceView);
    };

    let referenceImage_Sizer = new HorizontalSizer(this);
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(referenceImage_ViewList, 100);
    referenceImage_Sizer.add(referenceAutoStf_button);

    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target view:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = REFERENCE_VIEW_STR_LEN;
    targetImage_Label.toolTip = "<p>This image is cloned, then multiplied by " +
            "the photometrically determined scale factor, and finally the gradient " +
            "is calculated and subtracted.</p>";

    let targetImage_ViewList = new ViewList(this);
    targetImage_ViewList.getMainViews();
    targetImage_ViewList.minWidth = 470;
    if (data.targetView !== null){ // TODO check if this is correct
        targetImage_ViewList.currentView = data.targetView;
    }
    targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
        self.setApertureBgDeltaAutoValue();
        self.setSampleSizeAutoValue();
        self.setTaperLengthAutoValue(data);
        self.setSampleStarGrowthLimitAutoValue();
        self.setSampleStarGrowthLimitTargetAutoValue();
    };
    
    let targetAutoStf_button = new PushButton(this);
    targetAutoStf_button.text = "Auto STF";
    targetAutoStf_button.toolTip =
            "<p>Apply an auto ScreenTransferFunction to the target image.</p>" +
            "<p>The dialogs that display image data from the target image " +
            "rely on its STF to display the images correctly.</p>";
    targetAutoStf_button.onClick = function () {
        STFAutoStretch(data.targetView);
    };

    let targetImage_Sizer = new HorizontalSizer(this);
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(targetImage_ViewList, 100);
    targetImage_Sizer.add(targetAutoStf_button);
    
    let selectViewSection = new Control(this);
    selectViewSection.sizer = new VerticalSizer;
    selectViewSection.sizer.spacing = 4;
    selectViewSection.sizer.add(referenceImage_Sizer);
    selectViewSection.sizer.add(targetImage_Sizer);
    let selectViewBar = new SectionBar(this, "Reference & Target Views");
    selectViewBar.setSection(selectViewSection);
    selectViewBar.onToggleSection = this.onToggleSection;
    selectViewBar.toolTip = "Select the reference and target images.";
    // SectionBar "Reference & Target Views" End

    // =======================================
    // SectionBar: "Star Detection"
    // =======================================
    this.logStarDetection_Control = new NumericControl(this);
    this.logStarDetection_Control.real = true;
    this.logStarDetection_Control.label.text = "Star detection:";
    this.logStarDetection_Control.toolTip = "<p>Logarithm of the star detection " +
            "sensitivity. Increase this value to detect less stars.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.logStarDetection_Control.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.logStarDetection_Control.setPrecision(1);
    this.logStarDetection_Control.setRange(-2, 2);
    this.logStarDetection_Control.slider.setRange(0, 50);
    this.logStarDetection_Control.slider.minWidth = 50;
    this.logStarDetection_Control.setValue(data.logStarDetection);
    
    let starDetectionSection = new Control(this);
    starDetectionSection.sizer = new HorizontalSizer;
    starDetectionSection.sizer.add(this.logStarDetection_Control);
    starDetectionSection.sizer.addStretch();
    let starDetectionBar = new SectionBar(this, "Star Detection");
    starDetectionBar.setSection(starDetectionSection);
    starDetectionBar.onToggleSection = this.onToggleSection;
    starDetectionBar.toolTip = "<p>Star detection sensitivity.</p>" +
            "<p>The default settings usually work well.</p>";
    // SectionBar "Star Detection" End
    
    let photometrySearchSection;
    let photometrySearchBar;

    // =======================================
    // SectionBar: "Photometric Star Search"
    // =======================================
    const labelWidth = Math.max(
            this.font.width("Star flux tolerance:"), 
            this.font.width("Star search radius:"));
    this.starFluxTolerance_Control = new NumericControl(this);
    this.starFluxTolerance_Control.real = true;
    this.starFluxTolerance_Control.label.text = "Star flux tolerance:";
    this.starFluxTolerance_Control.toolTip =
            "<p>Star flux tolerance is used to prevent invalid target to reference " +
            "star matches. Smaller values reject more matches.</p>" +
            "<p>Star matches are rejected if the difference in star flux " +
            "is larger than expected. The algorithm first calculates the average scale difference, " +
            "and then rejects matches if their brightness ratio is greater than " +
            "(expected ratio * tolerance) or smaller than (expected ratio / tolerance)</p>" +
            "<p>1.0 implies the star flux ratio must exactly match the expected ratio.</p>" +
            "<p>2.0 implies that the ratio can be double or half the expected ratio.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starFluxTolerance_Control.label.minWidth = labelWidth;
    this.starFluxTolerance_Control.setRange(1.01, 2);
    this.starFluxTolerance_Control.slider.setRange(100, 200);
    this.starFluxTolerance_Control.setPrecision(2);
    this.starFluxTolerance_Control.slider.minWidth = 100;
    this.starFluxTolerance_Control.setValue(data.starFluxTolerance);
    this.starFluxTolerance_Control.onValueUpdated = function (value) {
        data.starFluxTolerance = value;
    };

    this.starSearchRadius_Control = new NumericControl(this);
    this.starSearchRadius_Control.real = true;
    this.starSearchRadius_Control.label.text = "Star search radius:";
    this.starSearchRadius_Control.toolTip =
            "<p>Search radius used to match the reference and target stars. " +
            "Larger values find more photometric stars but at the risk of matching " +
            "the wrong star.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";

    this.starSearchRadius_Control.label.minWidth = labelWidth;
    this.starSearchRadius_Control.setRange(1, 10);
    this.starSearchRadius_Control.slider.setRange(1, 100);
    this.starSearchRadius_Control.setPrecision(1);
    this.starSearchRadius_Control.slider.minWidth = 100;
    this.starSearchRadius_Control.setValue(data.starSearchRadius);
    this.starSearchRadius_Control.onValueUpdated = function (value) {
        data.starSearchRadius = value;
    };

    photometrySearchSection = new Control(this);
    photometrySearchSection.sizer = new VerticalSizer;
    photometrySearchSection.sizer.spacing = 4;
    photometrySearchSection.sizer.add(this.starFluxTolerance_Control);
    photometrySearchSection.sizer.add(this.starSearchRadius_Control);
    photometrySearchBar = new SectionBar(this, "Photometry Star Search");
    photometrySearchBar.setSection(photometrySearchSection);
    photometrySearchBar.onToggleSection = this.onToggleSection;
    photometrySearchBar.toolTip = "<p>Search criteria used to match reference and target stars.</p>" +
            "<p>The default settings usually work well.</p>";
    // SectionBar: "Photometric Star Search" End
    
    // =======================================
    // SectionBar: "Photometry"
    // =======================================
    let photometryControls = new PhotometryControls();
    
    this.apertureGrowthRate_Control = photometryControls.createApertureGrowthRateEdit(this, data);
    this.apertureGrowthRate_Control.onValueUpdated = function (value){
        data.apertureGrowthRate = value;
        self.setSampleStarGrowthRateAutoValue();
        self.setSampleStarGrowthRateTargetAutoValue();
    };
    this.apertureAdd_Control = photometryControls.createApertureAddEdit(this, data);
    this.apertureAdd_Control.onValueUpdated = function (value){
        data.apertureAdd = value;
    };
    if (EXTRA_CONTROLS()){
        this.apertureGrowthLimit_Control = photometryControls.createApertureGrowthLimitEdit(this, data);
        this.apertureGrowthLimit_Control.onValueUpdated = function (value){
            data.apertureGrowthLimit = value;
        };
    }
    this.apertureBgDelta_Control = photometryControls.createApertureBgDeltaEdit(this, data);
    this.apertureBgDelta_Control.onValueUpdated = function (value){
        data.apertureBgDelta = value;
    };
    let detectedStarsButton = new PushButton(this);
    detectedStarsButton.text = "Photometry stars ";
    detectedStarsButton.toolTip =
            "<p>Displays the photometry stars.</p>" + 
            "<p>Provides edit sliders for " +
            "'Radius add', 'Growth rate' and 'Background delta'.</p>" +
            "<p>These controls determine the photometry apertures.</p>";
    detectedStarsButton.onClick = function () {
        data.viewFlag = DISPLAY_DETECTED_STARS();
        this.dialog.ok();
    };
    let apertureGroupBox = new GroupBox(this);
    apertureGroupBox.title = "Aperture size";
    apertureGroupBox.sizer = new HorizontalSizer();
    apertureGroupBox.sizer.margin = 2;
    apertureGroupBox.sizer.spacing = 10;
    apertureGroupBox.sizer.add(this.apertureAdd_Control);
    apertureGroupBox.sizer.add(this.apertureGrowthRate_Control);
    if (EXTRA_CONTROLS()){
        apertureGroupBox.sizer.add(this.apertureGrowthLimit_Control);
    }
    apertureGroupBox.sizer.add(this.apertureBgDelta_Control);
    apertureGroupBox.sizer.addStretch();
    
    this.limitPhotoStarsPercent_Control = 
            photometryControls.createLimitPhotoStarsPercentEdit(this, data);
    this.limitPhotoStarsPercent_Control.onValueUpdated = function (value){
        data.limitPhotoStarsPercent = value;
    };
    
    this.linearRange_Control = photometryControls.createLinearRangeEdit(this, data);
    this.linearRange_Control.onValueUpdated = function (value){
        data.linearRange = value;
    };
    
    this.outlierRemoval_Control = 
            photometryControls.createOutlierRemovalEdit(this, data);
    this.outlierRemoval_Control.onValueUpdated = function (value){
        data.outlierRemoval = value;
    };
    
    let photometryGraphButton = new PushButton(this);
    photometryGraphButton.text = "Photometry graph";
    photometryGraphButton.toolTip =
            "<p>Displays the photometry graph. " +
            "Each star is plotted against its reference and target image flux. " +
            "A best fit line is drawn through these points (Least squares fit). " +
            "The gradient provides the brightness scale factor.</p>" +
            "<p>Provides edit sliders for " +
            "'Limit stars %', 'Linear range' and 'Outlier removal'.</p>" +
            "<p>These controls determine which stars are used to " +
            "calculate the best fit line (and hence the scale). </p>";
    photometryGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_PHOTOMETRY_GRAPH();
        this.dialog.ok();
    };
    
    let filterGroupBox = new GroupBox(this);
    filterGroupBox.title = "Filter stars";
    filterGroupBox.sizer = new HorizontalSizer(filterGroupBox);
    filterGroupBox.sizer.margin = 2;
    filterGroupBox.sizer.spacing = 10;
    filterGroupBox.sizer.add(this.limitPhotoStarsPercent_Control);
    filterGroupBox.sizer.add(this.linearRange_Control);
    filterGroupBox.sizer.add(this.outlierRemoval_Control);
    filterGroupBox.sizer.addStretch();
    
    let starButtonGroupBox = new GroupBox(this);
    starButtonGroupBox.title = "Edit / Display";
    starButtonGroupBox.sizer = new HorizontalSizer(starButtonGroupBox);
    starButtonGroupBox.sizer.margin = 2;
    starButtonGroupBox.sizer.addSpacing(10);
    starButtonGroupBox.sizer.add(detectedStarsButton);
    starButtonGroupBox.sizer.addSpacing(10);
    
    let graphButtonGroupBox = new GroupBox(this);
    graphButtonGroupBox.title = "Edit / Display";
    graphButtonGroupBox.sizer = new HorizontalSizer(starButtonGroupBox);
    graphButtonGroupBox.sizer.margin = 2;
    graphButtonGroupBox.sizer.addSpacing(10);
    graphButtonGroupBox.sizer.add(photometryGraphButton);
    graphButtonGroupBox.sizer.addSpacing(10);
    
    this.autoPhotometryCheckBox = new CheckBox(this);
    this.autoPhotometryCheckBox.text = "Auto";
    this.autoPhotometryCheckBox.toolTip = "<p>Automatically sets the following controls:</p>" +
            "<ul><li><b>Radius add</b></li>" +
            "<li><b>Growth rate</b></li>" +
            "<li><b>Background delta</b></li>" +
            "<li><b>Limit stars %</b></li>" +
            "<li><b>Linear range</b></li></ul>" +
            "<p>The 'Background delta' is calculated from the header entry " +
            "'XPIXSZ' (pixel size, including binning, in microns).</p>";
    this.autoPhotometryCheckBox.onCheck = function (checked){
        self.setPhotometryAutoValues(checked);
    };
    
    let photometryAutoGroupBox = new GroupBox(this);
    photometryAutoGroupBox.sizer = new HorizontalSizer();
    photometryAutoGroupBox.sizer.margin = 2;
    photometryAutoGroupBox.sizer.addSpacing(10);
    photometryAutoGroupBox.sizer.add(this.autoPhotometryCheckBox);
    photometryAutoGroupBox.sizer.addSpacing(10);
    
    let apertureHorizSizer = new HorizontalSizer();
    apertureHorizSizer.spacing = 12;
    apertureHorizSizer.add(apertureGroupBox, 100);
    apertureHorizSizer.add(photometryAutoGroupBox);
    apertureHorizSizer.add(starButtonGroupBox);
    
    let filterHorizSizer = new HorizontalSizer();
    filterHorizSizer.spacing = 12;
    filterHorizSizer.add(filterGroupBox, 100);
    filterHorizSizer.add(graphButtonGroupBox);

    let photometrySection = new Control(this);
    photometrySection.sizer = new VerticalSizer();
    photometrySection.sizer.spacing = 4;
    photometrySection.sizer.add(apertureHorizSizer);
    photometrySection.sizer.add(filterHorizSizer);
    let photometryBar = new SectionBar(this, "Photometry");
    photometryBar.setSection(photometrySection);
    photometryBar.onToggleSection = this.onToggleSection;
    photometryBar.toolTip = "<p>Specifies photometry parameters. These are used " +
            " to calculate the brightness scale factor.</p>";
    // SectionBar: "Photometric Scale" End
    
    this.setPhotometryAutoValues = function (checked){
        data.useAutoPhotometry = checked;
        self.autoPhotometryCheckBox.checked = checked;
        self.apertureAdd_Control.enabled = !checked;
        self.apertureGrowthRate_Control.enabled = !checked;
        self.apertureBgDelta_Control.enabled = !checked;
        self.limitPhotoStarsPercent_Control.enabled = !checked;
        self.linearRange_Control.enabled = !checked;
        if (checked){
            self.setApertureAddAutoValue();
            self.setApertureGrowthRateAutoValue();
            self.setApertureBgDeltaAutoValue();
            self.setLimitPhotoStarsPercentAutoValue();
            self.setLinearRangeAutoValue();
        }
    };
    this.setApertureAddAutoValue = function(){
        if (data.useAutoPhotometry){
            data.apertureAdd = APERTURE_ADD;
            self.apertureAdd_Control.setValue(data.apertureAdd);
        } 
    };
    this.setApertureGrowthRateAutoValue = function(){
        if (data.useAutoPhotometry){
            data.apertureGrowthRate = APERTURE_GROWTH;
            self.apertureGrowthRate_Control.setValue(data.apertureGrowthRate);
        } 
    };
    this.setApertureBgDeltaAutoValue = function(){
        if (data.useAutoPhotometry){
            data.apertureBgDelta = calcDefaultApertureBgDelta(data.targetView);
            self.apertureBgDelta_Control.setValue(data.apertureBgDelta);
        } 
    };
    this.setLimitPhotoStarsPercentAutoValue = function(){
        if (data.useAutoPhotometry){
            data.limitPhotoStarsPercent = 100;
            self.limitPhotoStarsPercent_Control.setValue(data.limitPhotoStarsPercent);
        } 
    };
    this.setLinearRangeAutoValue = function(){
        if (data.useAutoPhotometry){
            data.linearRange = 0.5;
            self.linearRange_Control.setValue(data.linearRange);
        } 
    };
    this.setPhotometryAutoValues(data.useAutoPhotometry);

    // =======================================
    // SectionBar: "Sample Generation"
    // =======================================
    const sampleGenerationStrLen = this.font.width("Multiply star radius:");
    let sampleControls = new SampleControls;

    this.limitSampleStarsPercent_Control = sampleControls.createLimitSampleStarsPercentEdit(this, data);       
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    
    let filterSampleStarsGroupBox = new GroupBox(this);
    filterSampleStarsGroupBox.title = "Filter stars";
    filterSampleStarsGroupBox.sizer = new HorizontalSizer();
    filterSampleStarsGroupBox.sizer.margin = 2;
    filterSampleStarsGroupBox.sizer.spacing = 10;
    filterSampleStarsGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    filterSampleStarsGroupBox.sizer.addStretch();
    
    this.sampleStarGrowthRate_Control = sampleControls.createSampleStarGrowthRateEdit(this, data);    
    this.sampleStarGrowthRate_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRate = value;
    };
    
    this.sampleStarGrowthLimit_Control = sampleControls.createSampleStarGrowthLimitEdit(this, data);
    this.sampleStarGrowthLimit_Control.onValueUpdated = function (value){
        data.sampleStarGrowthLimit = value;
    };
    
    this.sampleStarGrowthLimitTarget_Control = sampleControls.createSampleStarGrowthLimitTargetEdit(this, data);
    this.sampleStarGrowthLimitTarget_Control.onValueUpdated = function (value){
        data.sampleStarGrowthLimitTarget = value;
    };
    
    this.sampleStarGrowthRateTarget_Control = sampleControls.createSampleStarGrowthRateTargetEdit(this, data);
    this.sampleStarGrowthRateTarget_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRateTarget = value;
    };
    
    this.autoSampleGenerationCheckBox = new CheckBox(this);
    this.autoSampleGenerationCheckBox.text = "Auto";
    this.autoSampleGenerationCheckBox.toolTip = 
            "<p>Calculates default values for most of the Sample Generation parameters.</p>" +
            "<p>These are calculated from the headers:" +
            "<ul><li><b>'XPIXSZ'</b> (Pixel size, including binning, in microns)</li>" +
            "<li><b>'CDELT1'</b> (degrees per pixel). Plate solving an image creates the 'CDELT1' header.</li></p>";
    this.autoSampleGenerationCheckBox.onCheck = function (checked){
        self.setSampleGenerationAutoValues(checked);
    };
    
    let sampleAutoGroupBox = new GroupBox(this);
    sampleAutoGroupBox.sizer = new HorizontalSizer();
    sampleAutoGroupBox.sizer.margin = 2;
    sampleAutoGroupBox.sizer.addSpacing(10);
    sampleAutoGroupBox.sizer.add(this.autoSampleGenerationCheckBox);
    sampleAutoGroupBox.sizer.addSpacing(10);
    
    let sampleStarRejectRadiusGroupBox = new GroupBox(this);
    sampleStarRejectRadiusGroupBox.title = "Overlap model sample rejection";
    sampleStarRejectRadiusGroupBox.toolTip = "<p>This section determines which " +
            "samples are used to create the Overlap region's background gradient model. " +
            "This determines the gradient correction applied to the Overlap region.</p>" +
            "<p>The aim is to reject samples that contain bright stars. " +
            "It is not necessary to reject samples that only contain filter halos " +
            "or the scattered light around bright stars.</p>";
    sampleStarRejectRadiusGroupBox.sizer = new HorizontalSizer();
    sampleStarRejectRadiusGroupBox.sizer.margin = 2;
    sampleStarRejectRadiusGroupBox.sizer.spacing = 10;
    sampleStarRejectRadiusGroupBox.sizer.add(this.sampleStarGrowthRate_Control);
    sampleStarRejectRadiusGroupBox.sizer.add(this.sampleStarGrowthLimit_Control);
    sampleStarRejectRadiusGroupBox.sizer.addStretch();
    
    let sampleStarRejectRadiusGroupBox2 = new GroupBox(this);
    sampleStarRejectRadiusGroupBox2.title = "Target model sample rejection";
    sampleStarRejectRadiusGroupBox2.toolTip = "<p>This section determines which " +
            "samples are used to create the target image's background gradient model. " +
            "This determines the gradient correction applied to the rest of the target image.</p>" +
            "<p>The aim is to reject samples that cover any light from bright stars. " +
            "This includes diffraction spikes, filter halos " +
            "and the scattered light around bright stars. " +
            "Typically, the rejection radius needs to be quite large.</p>";
    sampleStarRejectRadiusGroupBox2.sizer = new HorizontalSizer();
    sampleStarRejectRadiusGroupBox2.sizer.margin = 2;
    sampleStarRejectRadiusGroupBox2.sizer.spacing = 10;
    sampleStarRejectRadiusGroupBox2.sizer.add(this.sampleStarGrowthRateTarget_Control);
    sampleStarRejectRadiusGroupBox2.sizer.add(this.sampleStarGrowthLimitTarget_Control);
    sampleStarRejectRadiusGroupBox2.sizer.addStretch();
    
    let sampleStarRejectRadiusSizer = new HorizontalSizer();
    sampleStarRejectRadiusSizer.spacing = 12;
    sampleStarRejectRadiusSizer.add(sampleStarRejectRadiusGroupBox, 50);
    sampleStarRejectRadiusSizer.add(sampleStarRejectRadiusGroupBox2, 50);
    sampleStarRejectRadiusSizer.add(sampleAutoGroupBox);
    
    this.sampleSize_Control = sampleControls.createSampleSizeEdit(
            this, data, sampleControls.sampleSize.range.max);
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    
    // =======================================
    // GroupBox: "Join"
    // =======================================
    this.joinPosition_Control = sampleControls.createJoinPositionEdit(this, data);
    this.joinPosition_Control.onValueUpdated = function (value){
        data.joinPosition = value;
    };

    this.joinSize_Control = sampleControls.createJoinSizeEdit(this, data);
    this.joinSize_Control.onValueUpdated = function (value) {
        data.joinSize = value;
        setJoinPositionRange(self.joinPosition_Control, data, true);
    };
    
    this.joinSizeGroupBox = new GroupBox(this);
    this.joinSizeGroupBox.title = "Join";
    this.joinSizeGroupBox.sizer = new HorizontalSizer;
    this.joinSizeGroupBox.sizer.margin = 2;
    this.joinSizeGroupBox.sizer.spacing = 10;
    this.joinSizeGroupBox.sizer.add(this.joinSize_Control, 100);
    this.joinSizeGroupBox.sizer.add(this.joinPosition_Control);
    this.joinSizeGroupBox.sizer.addStretch();
    
    let sampleSizeGroupBox = new GroupBox(this);
    sampleSizeGroupBox.title = "Samples";
    sampleSizeGroupBox.sizer = new HorizontalSizer();
    sampleSizeGroupBox.sizer.margin = 2;
    sampleSizeGroupBox.sizer.add(this.sampleSize_Control);
    sampleSizeGroupBox.sizer.addStretch();
    
    let displaySamplesButton = new PushButton(this);
    displaySamplesButton.text = "Sample generation";
    displaySamplesButton.toolTip =
            "<p>Displays the generated samples, the stars used to reject samples, " +
            "and the location of the join between the reference and target images.</p>" +
            "<p>Provides edit sliders for all 'Sample Generation' section parameters.</p>" +
            "<p>A surface spline is constructed from the generated samples to " +
            "model the relative gradient between the reference and target images.</p>" +
            "<p>Samples are rejected if they: " +
            "<ul><li>Contain one or more zero pixels in either image.</li>" +
            "<li>Are too close to a star included in the 'Limit stars %' list.</li></ul>" +
            "The surviving samples are drawn as squares. The stars used to " +
            "reject samples are indicated by circles.</p>";
    displaySamplesButton.onClick = function () {
        data.viewFlag = DISPLAY_GRADIENT_SAMPLES();
        this.dialog.ok();
    };
    
    let editDisplayGroupBox = new GroupBox(this);
    editDisplayGroupBox.title = "Edit / Display";
    editDisplayGroupBox.sizer = new HorizontalSizer();
    editDisplayGroupBox.sizer.margin = 2;
    editDisplayGroupBox.sizer.addSpacing(10);
    editDisplayGroupBox.sizer.add(displaySamplesButton);
    editDisplayGroupBox.sizer.addSpacing(10);
    
    let generateSamplesHorizSizer = new HorizontalSizer();
    generateSamplesHorizSizer.spacing = 12;
    generateSamplesHorizSizer.add(filterSampleStarsGroupBox, 33);
    generateSamplesHorizSizer.add(this.joinSizeGroupBox, 33);
    generateSamplesHorizSizer.add(sampleSizeGroupBox, 33);
    generateSamplesHorizSizer.add(editDisplayGroupBox);
    
    let maxSamplesSizer;
    if (EXTRA_CONTROLS()){
        this.maxSamples_Control = new NumericEdit(this);
        this.maxSamples_Control.real = false;
        this.maxSamples_Control.label.text = "Max samples:";
        this.maxSamples_Control.toolTip =
            "<p>Limits the number of samples used to create the surface spline. " +
            "If the number of samples exceed this limit, they are combined " +
            "(binned) to create super samples.</p>" +
            "<p>Increase if the overlap region is very large. " +
            "A larger number of samples increases the " +
            "theoretical maximum resolution of the surface spline. However, " +
            "small unbinned samples are noisier and require more smoothing. " +
            "The default value is usually a good compromise.</p>" +
            "<p>The time required to initialize the surface spline approximately " +
            "doubles every 1300 samples.</p>";
        this.maxSamples_Control.setRange(2000, 5000);
        this.maxSamples_Control.setValue(data.maxSamples);
        this.maxSamples_Control.enabled = false;

        let displayBinnedSamplesButton = new PushButton(this);
        displayBinnedSamplesButton.text = "Binned grid ";
        displayBinnedSamplesButton.toolTip =
                "<p>Displays the binned samples used to construct the surface spline " +
                "that models the relative gradient between the reference and target images.</p>" +
                "<p>Samples are binned to improve performance if the number of " +
                "samples exceeds the specified limit.</p>" +
                "<p>The area of each binned sample represents the number of samples " +
                "it was created from.</p>" +
                "<p>Each binned sample's center is calculated from " +
                "the center of mass of the samples it was created from.</p>" +
                "<p>To see which of the unbinned samples were rejected due to stars, " +
                "use 'Sample grid'.</p>";
        displayBinnedSamplesButton.onClick = function () {
            data.viewFlag = DISPLAY_BINNED_SAMPLES();
            this.dialog.ok();
        };

        maxSamplesSizer = new HorizontalSizer;
        maxSamplesSizer.spacing = 4;
        maxSamplesSizer.add(this.maxSamples_Control);
        maxSamplesSizer.addStretch();
        maxSamplesSizer.add(displayBinnedSamplesButton);
    }
    
    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new VerticalSizer;
    sampleGenerationSection.sizer.spacing = 4;
    sampleGenerationSection.sizer.add(sampleStarRejectRadiusSizer);
    sampleGenerationSection.sizer.add(generateSamplesHorizSizer);
    if (EXTRA_CONTROLS()){
        sampleGenerationSection.sizer.add(maxSamplesSizer);
    }
    let sampleGenerationBar = new SectionBar(this, "Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = 
            "<p>This section generates samples used to construct a surface spline " +
            "that models the relative gradient between the reference and target pixels " +
            "within the overlap region.</p>" +
            "<p>The overlap region is divided up into a grid of sample squares. " +
            "A sample's value is the median of the pixels it contains.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they are too close to a bright star.</p>";
    
    this.setSampleGenerationAutoValues = function (checked){
        data.useAutoSampleGeneration = checked;
        self.autoSampleGenerationCheckBox.checked = data.useAutoSampleGeneration;
        self.sampleStarGrowthRate_Control.enabled = !checked;
        self.sampleStarGrowthLimit_Control.enabled = !checked;
        self.sampleStarGrowthLimitTarget_Control.enabled = !checked;
        self.sampleStarGrowthRateTarget_Control.enabled = !checked;
        self.sampleSize_Control.enabled = !checked;
        if (checked){
            self.setSampleSizeAutoValue();
            self.setSampleStarGrowthRateAutoValue();
            self.setSampleStarGrowthLimitAutoValue();
            self.setSampleStarGrowthLimitTargetAutoValue();
            self.setSampleStarGrowthRateTargetAutoValue();
        }
    };
    this.setSampleSizeAutoValue = function(){
        if (data.useAutoSampleGeneration){
            let pixelAngle = getPixelAngularSize(data.targetView, 0.00025);
            // Make sure we sample at least 100 x 100 microns on the sensor
            let minSampleSize = Math.round(100 / getPixelSize(data.targetView, 5));
            minSampleSize = Math.max(minSampleSize, self.sampleSize_Control.lowerBound);
            // 0.005 deg = 18 arcsec (18 >> than than 4 arcsecond seeing)
            let size = Math.max(minSampleSize, Math.round(0.005 / pixelAngle));
            size = Math.min(size, self.sampleSize_Control.upperBound);
            data.sampleSize = size;
            self.sampleSize_Control.setValue(data.sampleSize);
        } 
    };
    this.setSampleStarGrowthLimitAutoValue = function(){
        if (data.useAutoSampleGeneration){
            let limit = Math.round(calcDefaultGrowthLimit(data.targetView));
            limit = Math.max(limit, 1);
            limit = Math.min(limit, self.sampleStarGrowthLimit_Control.upperBound);
            data.sampleStarGrowthLimit = limit;
            self.sampleStarGrowthLimit_Control.setValue(data.sampleStarGrowthLimit);
        }
    };
    this.setSampleStarGrowthLimitTargetAutoValue = function(){
        if (data.useAutoSampleGeneration){
            let limit = Math.round(10 * calcDefaultGrowthLimit(data.targetView));
            limit = Math.max(limit, 10);
            limit = Math.min(limit, self.sampleStarGrowthLimitTarget_Control.upperBound);
            data.sampleStarGrowthLimitTarget = limit;
            self.sampleStarGrowthLimitTarget_Control.setValue(limit);
        }
    };
    this.setSampleStarGrowthRateAutoValue = function(){
        if (data.useAutoSampleGeneration){
            data.sampleStarGrowthRate = Math.max(0.1, data.apertureGrowthRate);
            self.sampleStarGrowthRate_Control.setValue(data.sampleStarGrowthRate);
        }
    };
    this.setSampleStarGrowthRateTargetAutoValue = function(){
        if (data.useAutoSampleGeneration){
            data.sampleStarGrowthRateTarget = Math.max(0.5, data.apertureGrowthRate * 2);
            self.sampleStarGrowthRateTarget_Control.setValue(data.sampleStarGrowthRateTarget);
        }
    };
    this.setSampleGenerationAutoValues(data.useAutoSampleGeneration);
    
    // SectionBar: "Gradient Sample Generation" End

    // ===============================================================
    // SectionBar: "Gradient Correction" : Group box "Overlap region"
    // ===============================================================
    // Gradient controls
    let GRADIENT_LABEL_LEN = this.font.width("Taper length:");
    let gradientControls = new GradientControls();
    this.overlapGradientSmoothness_Control = 
            gradientControls.createOverlapGradientSmoothnessEdit(this, data);
    this.overlapGradientSmoothness_Control.onValueUpdated = function (value) {
        data.overlapGradientSmoothness = value;
    };
    
    let overlapGradientGraphButton = new PushButton(this);
    overlapGradientGraphButton.text = "Overlap gradient";
    overlapGradientGraphButton.toolTip =
        "<p>Edit the 'Smoothness' parameter and view the gradient along the join.</p>" +
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent samples close to the join path.</p>" +
        "<p>The plotted curve shows the gradient along the path of the " +
        "reference image - target image join.</p>" +
        "<p>To view or edit the position of the join, use the 'Sample generation' dialog.</p>";
    overlapGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_OVERLAP_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    let gradientOverlapGroupBox = new GroupBox(this);
    gradientOverlapGroupBox.title = "Overlap region";
    gradientOverlapGroupBox.sizer = new HorizontalSizer();
    gradientOverlapGroupBox.sizer.margin = 2;
    gradientOverlapGroupBox.sizer.spacing = 10;
    gradientOverlapGroupBox.sizer.add(this.overlapGradientSmoothness_Control);
    gradientOverlapGroupBox.sizer.addStretch();
    gradientOverlapGroupBox.sizer.add(overlapGradientGraphButton);
    gradientOverlapGroupBox.sizer.addSpacing(10);
    gradientOverlapGroupBox.toolTip = "<p>A surface spline is created to model the relative " +
            "gradient over the whole of the overlap region.</p>" +
            "<p>Smoothing is applied to this surface spline to ensure it follows " +
            "the gradient but not the noise.</p>";
    
    // =============================================================
    // SectionBar: "Gradient Correction" : Group box "Target Image"
    // =============================================================
    this.targetGradientSmoothness_Control = 
            gradientControls.createTargetGradientSmoothnessEdit(this, data);
    this.targetGradientSmoothness_Control.onValueUpdated = function (value) {
        data.targetGradientSmoothness = value;
    };
    
    let targetGradientGraphButton = new PushButton(this);
    targetGradientGraphButton.text = "Target gradient";
    targetGradientGraphButton.toolTip =
        "<p>Edit the 'Smoothness' parameter and view the gradient that will be " +
        "applied to the rest of the target image (i.e. outside the overlap region).</p>" +
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent samples close to the target side boundary of the " +
        "overlapping pixels.</p>" +
        "<p>The plotted curve shows the gradient correction that will be applied to the target image.</p>";
    targetGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_TARGET_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    this.setTargetGradientFlag = function (checked){
        data.useTargetGradientCorrection = checked;
        self.gradientTargetImageGroupBox.checked = checked;
        self.targetGradientSmoothness_Control.enabled = checked;
        targetGradientGraphButton.enabled = checked;
        self.setTaperLengthAutoValue(data);
    };
    
    this.gradientTargetImageGroupBox = new GroupBox(this);
    this.gradientTargetImageGroupBox.title = "Target image";
    this.gradientTargetImageGroupBox.titleCheckBox = true;
    this.gradientTargetImageGroupBox.onCheck = this.setTargetGradientFlag;
    this.gradientTargetImageGroupBox.sizer = new HorizontalSizer();
    this.gradientTargetImageGroupBox.sizer.margin = 2;
    this.gradientTargetImageGroupBox.sizer.spacing = 10;
    this.gradientTargetImageGroupBox.sizer.add(this.targetGradientSmoothness_Control);
    this.gradientTargetImageGroupBox.sizer.addStretch();
    this.gradientTargetImageGroupBox.sizer.add(targetGradientGraphButton);
    this.gradientTargetImageGroupBox.sizer.addSpacing(10);
    this.gradientTargetImageGroupBox.toolTip = 
            "<p>If selected, a gradient correction is applied " +
            "to the rest of the target image (i.e. outside the overlap region).</p>" +
            "<p>If not selected, only the average background offset is applied.</p>" +
            "<p>In most situations, this option should be selected.</p>";
    
    let gradientsHorizSizer = new HorizontalSizer();
    gradientsHorizSizer.spacing = 12;
    gradientsHorizSizer.add(gradientOverlapGroupBox, 50);
    gradientsHorizSizer.add(this.gradientTargetImageGroupBox, 50);
    
    // ========================================================================================
    // SectionBar: "Gradient Correction" : Group box "Overlap to Target transition"
    // ========================================================================================
    let taperTooltip = "<p>The taper length should be a similar size to the scale of " +
        "local gradients - i.e. how far scattered light extends around bright stars.</p>" +
        "<p>The gradient within the overlap region can be accurately " +
        "calculated, and only requires a small amount of smoothing to remove noise.</p>" +
        "<p>The gradient applied to the rest of the target frame is based on the " +
        "gradient at the target side of the overlap region. Local variations in the " +
        "gradient need to be filtered out by rejecting more samples around bright stars, " +
        "and by applying more smoothing.</p>" +
        "<p>The taper length provides a tapered transition between these two regions. " +
        "This transition zone is in the Target image area, " +
        "starting from the edge of the overlap's bounding box.</p>";
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Taper length:";
    this.taperLength_Control.label.minWidth = GRADIENT_LABEL_LEN;
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(0, 2000);
    this.taperLength_Control.slider.setRange(0, 200);
    this.taperLength_Control.slider.minWidth = 500;
    this.taperLength_Control.setValue(data.taperLength);
    
    this.autoTaperLengthCheckBox = new CheckBox(this);
    this.autoTaperLengthCheckBox.text = "Auto";
    this.autoTaperLengthCheckBox.toolTip = "<p>Automatically determine the taper length.</p>" +
            "<p>The calculation uses the header entry 'CDELT1' (degrees per pixel).</p>";
    this.autoTaperLengthCheckBox.onCheck = function (checked){
        data.useAutoTaperLength = checked;
        self.setTaperLengthAutoValue(data);
    };
    this.autoTaperLengthCheckBox.checked = data.useAutoTaperLength;
    
    this.setTaperLengthAutoValue = function(data){
        if (data.useAutoTaperLength){
            let taperLength;
            if (data.useTargetGradientCorrection){ // TODO if targetView is null?
                taperLength = Math.max(10, Math.round(5 * calcDefaultGrowthLimit(data.targetView)));
            } else {
                // No target image gradient correction. This requires a longer tager
                taperLength = 1000;
            }
            taperLength = Math.min(taperLength, self.taperLength_Control.upperBound);
            data.taperLength = taperLength;
            self.taperLength_Control.setValue(data.taperLength);
        }
        self.taperLength_Control.enabled = !data.useAutoTaperLength;
    };
    
    let gradientTaperGroupBox = new GroupBox(this);
    gradientTaperGroupBox.title = "Overlap to Target transition";
    gradientTaperGroupBox.sizer = new HorizontalSizer();
    gradientTaperGroupBox.sizer.margin = 2;
    gradientTaperGroupBox.sizer.add(this.taperLength_Control);
    gradientTaperGroupBox.sizer.addSpacing(20);
    gradientTaperGroupBox.sizer.add(this.autoTaperLengthCheckBox);
    gradientTaperGroupBox.toolTip = taperTooltip;
    
    let gradientSection = new Control(this);
    gradientSection.sizer = new VerticalSizer(this);
    gradientSection.sizer.spacing = 4;
    gradientSection.sizer.add(gradientsHorizSizer);
    gradientSection.sizer.add(gradientTaperGroupBox);
    let gradientBar = new SectionBar(this, "Gradient Correction");
    gradientBar.setSection(gradientSection);
    gradientBar.onToggleSection = this.onToggleSection;
//    gradientBar.toolTip = "<p></p>";

    this.setTargetGradientFlag(data.useTargetGradientCorrection);
    // SectionBar: "Gradient Correction" End

    // ===========================================
    // SectionBar: Replace/Update Region
    // GroupBox Join Region (From Preview)
    // ===========================================
    const getAreaFromPreviewStr = "From preview:";
    const GET_AREA_FROM_PREVIEW_STRLEN = this.font.width(getAreaFromPreviewStr);
    const replaceUpdateRegionTooltip =
            "<p>This section is used to add extra data inside a completed mosaic. " +
            "<p>For example, extra data could be added to improve the signal to noise " +
            "of an existing region (use Mosaic Join Mode 'Average').</p>" +
            "<p>Alternatively, an area with poor resolution - for example areas " +
            "that were close to image corners - can be replaced " +
            "(use Mosaic Join Mode 'Overlay').</p>";
    
    /**
     * 
     * @param {String} label
     * @param {String} tooltip
     * @param {Number} initialValue
     * @param {Number} editWidth
     * @returns {NumericEdit}
     */
    function createPreviewNumericEdit(label, tooltip, initialValue, editWidth) {
        let control = new NumericEdit();
        control.setReal(false);
        control.setRange(0, 100000);
        control.setValue(initialValue);
        control.label.text = label;
        control.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
        control.edit.setFixedWidth(editWidth);
        control.toolTip = tooltip;
        return control;
    }
    
    let x0ToolTip = "X-coordinate of region's top left corner";
    this.rectangleX0_Control = createPreviewNumericEdit("Left:", x0ToolTip,
            data.cropTargetPreviewRect.x0, 50);
    this.rectangleX0_Control.label.setFixedWidth(
            this.font.width("Left:") + GET_AREA_FROM_PREVIEW_STRLEN + 4);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.cropTargetPreviewRect = getCropTargetPreviewRect();
    };
    let y0ToolTip = "Y-coordinate of region's top left corner";
    this.rectangleY0_Control = createPreviewNumericEdit("Top:", y0ToolTip,
            data.cropTargetPreviewRect.y0, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.cropTargetPreviewRect = getCropTargetPreviewRect();
    };
    this.rectangleWidth_Control = createPreviewNumericEdit("Width:", "Region's width",
            data.cropTargetPreviewRect.width, 50);
    this.rectangleWidth_Control.onValueUpdated = function (value){
        data.cropTargetPreviewRect = getCropTargetPreviewRect();
    };
    this.rectangleHeight_Control = createPreviewNumericEdit("Height:", "Region's height",
            data.cropTargetPreviewRect.height, 50);
    this.rectangleHeight_Control.onValueUpdated = function (value){
        data.cropTargetPreviewRect = getCropTargetPreviewRect();
    };
    
    function getCropTargetPreviewRect(){
        let x = self.rectangleX0_Control.value;
        let y = self.rectangleY0_Control.value;
        let w = self.rectangleWidth_Control.value;
        let h = self.rectangleHeight_Control.value;
        return new Rect(x, y, x + w, y + h);
    }

    let cropTargetHorizSizer1 = new HorizontalSizer(this); 
    cropTargetHorizSizer1.spacing = 10;
    cropTargetHorizSizer1.add(this.rectangleX0_Control);
    cropTargetHorizSizer1.add(this.rectangleY0_Control);
    cropTargetHorizSizer1.add(this.rectangleWidth_Control);
    cropTargetHorizSizer1.add(this.rectangleHeight_Control);
    cropTargetHorizSizer1.addStretch();

    function previewUpdateActions(dialog){
        let view = dialog.previewImage_ViewList.currentView;
        if (view !== null && view.isPreview) {
            data.cropTargetPreviewRect = view.window.previewRect(view);
            dialog.rectangleX0_Control.setValue(data.cropTargetPreviewRect.x0);
            dialog.rectangleY0_Control.setValue(data.cropTargetPreviewRect.y0);
            dialog.rectangleWidth_Control.setValue(data.cropTargetPreviewRect.width);
            dialog.rectangleHeight_Control.setValue(data.cropTargetPreviewRect.height);
            
            dialog.setUseCropTargetToReplaceRegion(true);
        } else {
            dialog.setUseCropTargetToReplaceRegion(false);
        }
    };

    // Get Area from preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = getAreaFromPreviewStr;
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Get the area of the mosaic to be replaced/updated from a preview.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        previewUpdateActions(this.dialog);
    };

    let previewUpdateButton = new PushButton(this);
    previewUpdateButton.hasFocus = false;
    previewUpdateButton.text = "Update";
    previewUpdateButton.toolTip = "<p>Reset the text boxes to the selected preview's coordinates.</p>";
    previewUpdateButton.onClick = function () {
        if (!this.isUnderMouse){
            // Ensure pressing return in a different field does not trigger this callback!
            return;
        }
        previewUpdateActions(this.dialog);
    };

    let cropTargetHorizSizer2 = new HorizontalSizer(this);
    cropTargetHorizSizer2.spacing = 4;
    cropTargetHorizSizer2.add(previewImage_Label);
    cropTargetHorizSizer2.add(this.previewImage_ViewList, 100);
    cropTargetHorizSizer2.addSpacing(10);
    cropTargetHorizSizer2.add(previewUpdateButton);
    
    this.setUseCropTargetToReplaceRegion = function(checked){
        replaceUpdateBar.checkBox.checked = checked;
        data.useCropTargetToReplaceRegion = checked;
        self.rectangleX0_Control.enabled = checked;
        self.rectangleWidth_Control.enabled = checked;
        self.rectangleY0_Control.enabled = checked;
        self.rectangleHeight_Control.enabled = checked;
        enableJoinSizeControl();
        self.joinPosition_Control.enabled = !checked;
        self.gradientTargetImageGroupBox.enabled = !checked;  
    };
    
    this.cropTargetGroupBox = new GroupBox(this);
    this.cropTargetGroupBox.title = "Area of mosaic to be replaced/updated";
    this.cropTargetGroupBox.toolTip = replaceUpdateRegionTooltip;
    this.cropTargetGroupBox.sizer = new VerticalSizer(this);
    this.cropTargetGroupBox.sizer.margin = 2;
    this.cropTargetGroupBox.sizer.spacing = 4;
    this.cropTargetGroupBox.sizer.add(cropTargetHorizSizer1);
    this.cropTargetGroupBox.sizer.add(cropTargetHorizSizer2);
    // GroupBox "Join Region (User defined)" End
    
    let replaceUpdateSection = new Control(this);
    replaceUpdateSection.sizer = new VerticalSizer;
    replaceUpdateSection.sizer.spacing = 4;
    replaceUpdateSection.sizer.add(this.cropTargetGroupBox);
    let replaceUpdateBar = new SectionBar(this, "Replace/Update Region");
    replaceUpdateBar.enableCheckBox();
    replaceUpdateBar.checkBox.onCheck = this.setUseCropTargetToReplaceRegion;
    replaceUpdateBar.setSection(replaceUpdateSection);
    replaceUpdateBar.onToggleSection = this.onToggleSection;
    replaceUpdateBar.toolTip = replaceUpdateRegionTooltip;
    // SectionBar "Join Region" End


    // =======================================
    // SectionBar: "Mosaic Join Mode"
    // =======================================
    let overlay_Label = new Label(this);
    overlay_Label.text = "Combination mode:";
    overlay_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    overlay_Label.minWidth = this.font.width("Overlay:");
    
    this.mosaicOverlay_Control = new RadioButton(this);
    this.mosaicOverlay_Control.text = "Overlay";
    this.mosaicOverlay_Control.toolTip =
        "<p>Reference pixels are drawn on top of target pixels on the reference side of the join.</p>" +
        "<p>Target pixels are drawn on top of reference pixels on the target side of the join.</p>" +
        "<p>Use the 'Sample Generation' dialog to view and adjust the position of the join.</p>";
    this.mosaicOverlay_Control.checked = data.useMosaicOverlay;
    this.mosaicOverlay_Control.onClick = function (checked) {
        updateMosaicMode(true, false, false);
    };

    this.mosaicRandom_Control = new RadioButton(this);
    this.mosaicRandom_Control.text = "Random";
    this.mosaicRandom_Control.toolTip = "<p>Within the Join Region, pixels " +
            "are randomly chosen from the reference and target images.</p>" +
            "<p>Use the 'Sample Generation' dialog to view and adjust the " +
            "size and position of the Join Region.</p>" +
            "<p>This mode is particularly effective at hiding the join, but if " +
            "the star profiles in the reference and target images don't match, " +
            "this can lead to speckled pixels around the stars.</p>" +
            "<p>These speckled star artifacts can be fixed by using PixelMath " +
            "to apply either the reference or target image to the mosaic through " +
            "a mask that only reveals the bright stars. The 'Star Mask' dialog " +
            "has been provided to create a suitable mask.</p>";
    this.mosaicRandom_Control.checked = data.useMosaicRandom;
    this.mosaicRandom_Control.onClick = function (checked) {
        updateMosaicMode(false, true, false);
    };
    
    this.mosaicAverage_Control = new RadioButton(this);
    this.mosaicAverage_Control.text = "Average";
    this.mosaicAverage_Control.toolTip = "<p>Within the join region, " +
            "pixels are set to the average of the reference and target pixels.</p>" +
            "<p>Use the 'Sample Generation' dialog to view and adjust the " +
            "size and position of the Join Region.</p>" +
            "<p>This mode has the advantage of increasing the signal to noise ratio " +
            "over the join, but this can also make the join more visible.</p>" +
            "<p>To average the whole of the overlap region, " +
            "set the Join Size to its maximum size.</p>";
    this.mosaicAverage_Control.checked = data.useMosaicAverage;
    this.mosaicAverage_Control.onClick = function (checked) {
        updateMosaicMode(false, false, true);
    };
    
    /**
     * Sets the boolean flags.
     * Updates the data.joinPosition
     * Updates the join position control's range and value.
     * Enables/disables the Join Size control.
     * @param {Boolean} isOverlay
     * @param {Boolean} isRandom
     * @param {Boolean} isAverage
     */
    function updateMosaicMode(isOverlay, isRandom, isAverage){
        data.useMosaicOverlay = isOverlay;
        data.useMosaicRandom = isRandom;
        data.useMosaicAverage = isAverage;
        if (data.cache.overlap !== null){
            // If changing from overlay to random or average, join position may change.
            // The join position range will almost always change
            let joinRegion = new JoinRegion(data);
            // Update data.joinPosition
            joinRegion.updateJoinPosition();
            // Update control range and value
            let range = joinRegion.getJoinPositionRange();
            self.joinPosition_Control.setRange(range.min, range.max);
            self.joinPosition_Control.setValue(data.joinPosition);
        }
        enableJoinSizeControl();
    }
    
    function enableJoinSizeControl(){
        self.joinSize_Control.enabled = 
                !self.mosaicOverlay_Control.checked && !data.useCropTargetToReplaceRegion;
    }
    // this also calls enableJoinSizeControl()
    this.setUseCropTargetToReplaceRegion(data.useCropTargetToReplaceRegion);
    
    let starsMaskButton = new PushButton(this);
    starsMaskButton.text = "Star mask";
    starsMaskButton.toolTip =
            "<p>Displays the 'Create Star Mask' dialog. Used to create a " +
            "star mask for the Join Region, or to create a corrected target image.</p>" + 
            "<p>The 'Random' combine mode can leave speckle artifacts around stars. " +
            "The generated mask can be used to replace these stars with stars " +
            "from the reference frame.</p>" +
            "<p>The required Pixel Math expression is simply the name of the reference image.</p>" +
            "<p>It is also possible to replace the speckled stars with stars from the " +
            "target frame, but the target image must first be corrected for scale and gradient. " +
            "The 'Correct target' button creates a fully corrected target image.</p>";
    starsMaskButton.onClick = function () {
        data.viewFlag = DISPLAY_MOSAIC_MASK_STARS();
        this.dialog.ok();
    };
    
    this.joinMask_CheckBox = new CheckBox(this);
    this.joinMask_CheckBox.text = "Join mask";
    this.joinMask_CheckBox.toolTip =
            "<p>Create a mask of the join. Apply this to the mosaic to view " +
            "the position of the join. Use <b>Ctrl K</b> to show/hide the mask " +
            "to judge the join's quality.</p>" + 
            "<p><u>Mosaic Join Mode: Overlay</u><br />" +
            "The mask is a line that indicates the path of the join.</p>" +
            "<p><u>Mosaic Join Mode: Random or Average</u><br />" +
            "The mask reveals the Join Region. Within this area the " +
            "mosaic pixels were either randomly chosen from the reference " +
            "and target image, or averaged.</p>";
    this.joinMask_CheckBox.onCheck = function (checked) {
        data.createJoinMask = checked;
    };
    this.joinMask_CheckBox.checked = data.createJoinMask;
    
    let mosaicSection = new Control(this);
    mosaicSection.sizer = new HorizontalSizer(this);
    mosaicSection.sizer.spacing = 10;
    mosaicSection.sizer.add(overlay_Label);
    mosaicSection.sizer.add(this.mosaicOverlay_Control);
    mosaicSection.sizer.add(this.mosaicRandom_Control);
    mosaicSection.sizer.add(this.mosaicAverage_Control);
    mosaicSection.sizer.addSpacing(20);
    mosaicSection.sizer.add(this.joinMask_CheckBox);
    mosaicSection.sizer.addStretch();
    mosaicSection.sizer.add(starsMaskButton);
    this.mosaicBar = new SectionBar(this, "Mosaic Join Mode");
    this.mosaicBar.setSection(mosaicSection);
    this.mosaicBar.onToggleSection = this.onToggleSection;
    // SectionBar: "Create Mosaic" End
    

    const helpWindowTitle = TITLE() + " Help";
    const HELP_MSG =
            "<p>To install this script, use 'SCRIPT \> Feature Scripts...' and then in the " +
            "'Feature Scripts' dialog box, press the 'Add' button and select the folder " +
            "where you unzipped this script.</p>" +
            "<p>To install the help files, unzip 'PhotometricMosaicHelp.zip' to " +
            "'[PixInsight]/doc/scripts/'</p>" +
            "<p>For example, on Windows, the correct installation would include:</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/PhotometricMosaic.html</p>" +
            "<p>C:/Program Files/PixInsight/doc/scripts/PhotometricMosaic/images/</p>";
    
    let okTooltip = "<p>Create the mosaic using the specified combination mode.</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, 
            helpWindowTitle, HELP_MSG, "PhotometricMosaic", okTooltip);

    //---------------------------------------------------------------
    // Vertically stack all the SectionBars and OK/Cancel button bar
    //---------------------------------------------------------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleBar);
    this.sizer.add(titleSection);
    this.sizer.add(selectViewBar);
    this.sizer.add(selectViewSection);
    this.sizer.add(starDetectionBar);
    this.sizer.add(starDetectionSection);
    this.sizer.add(photometrySearchBar);
    this.sizer.add(photometrySearchSection);
    this.sizer.add(photometryBar);
    this.sizer.add(photometrySection);
    this.sizer.add(this.mosaicBar);
    this.sizer.add(mosaicSection);
    this.sizer.add(replaceUpdateBar);
    this.sizer.add(replaceUpdateSection);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(gradientBar);
    this.sizer.add(gradientSection);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);
    
    starDetectionSection.hide();
    photometrySearchSection.hide();
    replaceUpdateSection.hide();

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
    console.show();
    console.abortEnabled = false; // Allowing abort would complicate cache strategy
    console.writeln("\n\n=== <b>" + TITLE() + " ", VERSION(), "</b> ===");
    const MAJOR = 1;
    const MINOR = 8;
    const RELEASE = 8;
    const REVISION = 5;
    if (!isVersionOk(MAJOR, MINOR, RELEASE, REVISION)){
        displayVersionWarning(MAJOR, MINOR, RELEASE, REVISION);
    }

    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: There must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new PhotometricMosaicData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    } else {
        restoreSettings(data);
    }

    let exception = null;
    let checkedRefViewId = "";
    let checkedTgtViewId = "";
    let photometricMosaicDialog = new PhotometricMosaicDialog(data);
    for (; ; ) {
        data.viewFlag = 0;
        if (!photometricMosaicDialog.execute())
            break;

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
            (new MessageBox("ERROR: Both images must have the same color depth", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.useCropTargetToReplaceRegion){
            if (data.cropTargetPreviewRect.x1 > data.targetView.image.width || 
                    data.cropTargetPreviewRect.y1 > data.referenceView.image.height){
                (new MessageBox("ERROR: Join Region Preview extends beyond the edge of the image\n" +
                "Have you selected the wrong preview?", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
                continue;
            }
        }
        if (data.targetView.fullId === data.referenceView.fullId) {
            (new MessageBox("ERROR: Target and Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.useCropTargetToReplaceRegion && data.useMosaicRandom){
            (new MessageBox("The 'Replace/Update Region' option is incompatible with the 'Random' mosaic mode.", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        let getTrimMessageBox = function(imageView){
            let imageName = imageView.fullId;
            let msg = "<p>Warning: '<b>" + imageName + "</b>' has not been trimmed by the <b>" + TRIM_NAME() + "</b> script.</p>" +
                    "<p><b>PhotometricMosaic</b> requires the images to have hard edges.<br>" +
                    "Registration and Image integration or color combine can produce ragged edges. " +
                    "Soft edges can also be introduced by the MosaicByCoordinates script.</p>" +
                    "<p>A soft edge can produce fine lines at some places in the join.\n" +
                    "Rough edges can cause a complete failure to blend the two images, especially at the ends of the join.</p>" +
                    "<p>Use <b>" + TRIM_NAME() + "</b> to errode pixels from the edges of the registered mosaic tiles.</p>";
            return new MessageBox(msg, "Warning: Image may have soft or rough edges", 
                StdIcon_Warning, StdButton_Ignore, StdButton_Abort);
        };
        
        if (checkedRefViewId !== data.referenceView.fullId && 
                !(searchFitsHistory(data.referenceView, TRIM_NAME()) || searchFitsHistory(data.referenceView, "TrimImage"))){
            console.warningln("Warning: '" + data.referenceView.fullId + "' has not been trimmed by the " + TRIM_NAME() + " script");
            if (getTrimMessageBox(data.referenceView).execute() === StdButton_Abort){
                console.warningln("Aborted. Use " + TRIM_NAME() + " script to errode pixels from the registered image edges.");
                return;
            } else {
                checkedRefViewId = data.referenceView.fullId;
            }
        }
        
        if (checkedTgtViewId !== data.targetView.fullId){
            if (!(searchFitsHistory(data.targetView, TRIM_NAME()) || searchFitsHistory(data.targetView, "TrimImage"))){
                console.warningln("Warning: '" + data.targetView.fullId + "' has not been trimmed by the " + TRIM_NAME() + " script");
                if (getTrimMessageBox(data.targetView).execute() === StdButton_Abort){
                    console.warningln("Aborted. Use " + TRIM_NAME() + " script to errode pixels from the registered image edges.");
                    return;
                }
            }
            if (!searchFits(data.targetView, "CDELT1") || !searchFits(data.targetView, "XPIXSZ")){
                let msg = "<p>Unable to find an ImageSolver header entry ('CDELT1' or 'XPIXSZ').</p>" +
                        "<p>The 'auto' default settings should not be relied upon.</p>";
                let response = (new MessageBox(msg, "Missing header entry 'CDELT1' or 'XPIXSZ'",
                    StdIcon_Warning, StdButton_Ignore, StdButton_Abort)).execute();
                let consoleMsg = "Failed to find an ImageSolver header entry ('CDELT1' or 'XPIXSZ')";
                if (response === StdButton_Abort){
                    console.warningln("Aborted. " + consoleMsg);
                    return;
                } else {
                    console.warningln(consoleMsg);
                }
            }
            checkedTgtViewId = data.targetView.fullId;
        }

        // Run the script
        try {
            photometricMosaic(data, photometricMosaicDialog);
            data.saveParameters();  // Save script parameters to the history.
        } catch (e){
            exception = e;
            new MessageBox("" + e, TITLE(), StdIcon_Error, StdButton_Ok).execute();
            break;
        }
    }
    if (data.cache !== undefined){
        data.cache.invalidate();
    }
    if (exception === null){
        console.hide();
    } else {
        throw exception;
    }
    return;
}
