/* global ImageWindow, Parameters, View, TextAlign_Right, TextAlign_VertCenter, StdIcon_Error, StdButton_Ok, Dialog, StdButton_Yes, StdIcon_Question, StdButton_No, StdButton_Cancel, Settings, DataType_Float, KEYPREFIX, DataType_Int32, DataType_Boolean, StdButton_Abort, StdIcon_Warning, StdButton_Ignore */
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
#define KEYPREFIX "PhotometricMosaic"

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
        Parameters.set("limitPhotoStarsPercent", this.limitPhotoStarsPercent);
        Parameters.set("linearRange", this.linearRange);
        Parameters.set("outlierRemoval", this.outlierRemoval);
        
        // Join Region
        Parameters.set("hasJoinSize", this.hasJoinSize);
        Parameters.set("joinSize", this.joinSize);
        
        // Join Region (Advanced settings)
        Parameters.set("hasJoinAreaPreview", this.hasJoinAreaPreview);
        Parameters.set("joinAreaPreviewLeft", this.joinAreaPreviewRect.x0);
        Parameters.set("joinAreaPreviewTop", this.joinAreaPreviewRect.y0);
        Parameters.set("joinAreaPreviewWidth", this.joinAreaPreviewRect.width);
        Parameters.set("joinAreaPreviewHeight", this.joinAreaPreviewRect.height);
        Parameters.set("taperFromJoin", this.taperFromJoin);
        Parameters.set("cropTargetToJoinRegionFlag", this.cropTargetToJoinRegionFlag);
        
        // Gradient Sample Generation
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("sampleStarRadiusMult", this.sampleStarRadiusMult);
        Parameters.set("maxSamples", this.maxSamples);
        
        // Gradient Correction (Overlap region)
        Parameters.set("overlapGradientSmoothness", this.overlapGradientSmoothness);
        Parameters.set("taperLength", this.taperLength);
        
        // Gradient Correction (Target image)
        Parameters.set("targetGradientFlag", this.targetGradientFlag);
        Parameters.set("targetGradientSmoothness", this.targetGradientSmoothness);
        
        // Mosaic Star Mask
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("maskStarRadiusMult", this.maskStarRadiusMult);
        Parameters.set("maskStarRadiusAdd", this.maskStarRadiusAdd);
        
        // Create Mosaic
        Parameters.set("mosaicOverlayTgtFlag", this.mosaicOverlayTgtFlag);
        Parameters.set("mosaicRandomFlag", this.mosaicRandomFlag);
        Parameters.set("mosaicAverageFlag", this.mosaicAverageFlag); 
        
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
        if (Parameters.has("limitPhotoStarsPercent"))
            this.limitPhotoStarsPercent = Parameters.getReal("limitPhotoStarsPercent");
        if (Parameters.has("linearRange"))
            this.linearRange = Parameters.getReal("linearRange");
        if (Parameters.has("outlierRemoval"))
            this.outlierRemoval = Parameters.getInteger("outlierRemoval");
        
        // Join Region
        if (Parameters.has("hasJoinSize"))
            this.hasJoinSize = Parameters.getBoolean("hasJoinSize");
        if (Parameters.has("joinSize"))
            this.joinSize = Parameters.getInteger("joinSize");
        
        // Join Region (Advanced settings)
        {
            let x = 0;
            let y = 0;
            let w = 1;
            let h = 1;
            
            if (Parameters.has("hasJoinAreaPreview"))
                this.hasJoinAreaPreview = Parameters.getBoolean("hasJoinAreaPreview");
            if (Parameters.has("joinAreaPreviewLeft")){
                x = Parameters.getInteger("joinAreaPreviewLeft");
            }
            if (Parameters.has("joinAreaPreviewTop")){
                y = Parameters.getInteger("joinAreaPreviewTop");
            }
            if (Parameters.has("joinAreaPreviewWidth")){
                w = Parameters.getInteger("joinAreaPreviewWidth");
            }
            if (Parameters.has("joinAreaPreviewHeight")){
                h = Parameters.getInteger("joinAreaPreviewHeight");
            }
            this.joinAreaPreviewRect = new Rect(x, y, x + w, y + h);
            
            if (Parameters.has("taperFromJoin"))
                this.taperFromJoin = Parameters.getBoolean("taperFromJoin");
            if (Parameters.has("cropTargetToJoinRegionFlag"))
                this.cropTargetToJoinRegionFlag = Parameters.getBoolean("cropTargetToJoinRegionFlag");
        }
        
        // Gradient Sample Generation
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("sampleStarRadiusMult"))
            this.sampleStarRadiusMult = Parameters.getReal("sampleStarRadiusMult");
        if (Parameters.has("maxSamples"))
            this.maxSamples = Parameters.getInteger("maxSamples");
        
        // Gradient Correction (Overlap region)
        if (Parameters.has("overlapGradientSmoothness"))
            this.overlapGradientSmoothness = Parameters.getReal("overlapGradientSmoothness");
        if (Parameters.has("taperLength"))
            this.taperLength = Parameters.getInteger("taperLength");
        
        // Gradient Correction (Target image)
        if (Parameters.has("targetGradientFlag"))
            this.targetGradientFlag = Parameters.getBoolean("targetGradientFlag");
        if (Parameters.has("targetGradientSmoothness"))
            this.targetGradientSmoothness = Parameters.getReal("targetGradientSmoothness");
        
        // Mosaic Star Mask
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("maskStarRadiusMult"))
            this.maskStarRadiusMult = Parameters.getReal("maskStarRadiusMult");
        if (Parameters.has("maskStarRadiusAdd"))
            this.maskStarRadiusAdd = Parameters.getReal("maskStarRadiusAdd");
        
        // Create Mosaic
        if (Parameters.has("mosaicOverlayTgtFlag"))
            this.mosaicOverlayTgtFlag = Parameters.getBoolean("mosaicOverlayTgtFlag");
        if (Parameters.has("mosaicRandomFlag"))
            this.mosaicRandomFlag = Parameters.getBoolean("mosaicRandomFlag");
        if (Parameters.has("mosaicAverageFlag"))
            this.mosaicAverageFlag = Parameters.getBoolean("mosaicAverageFlag");
        
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
        this.starFluxTolerance = 1.2;
        this.starSearchRadius = 2.5;
        
        // Photometric Scale
        this.limitPhotoStarsPercent = 100;
        this.linearRange = 0.5;
        this.outlierRemoval = 0;
        
        // Join Region
        this.hasJoinSize = true;
        this.joinSize = 20;
        
        // Join Region (Advanced settings)
        this.hasJoinAreaPreview = false;
        this.joinAreaPreviewRect = new Rect(0, 0, 1, 1);
        this.taperFromJoin = false;
        this.cropTargetToJoinRegionFlag = false;
        
        // Gradient Sample Generation
        this.limitSampleStarsPercent = 10;
        this.sampleSize = 15;
        this.sampleStarRadiusMult = 5;
        this.maxSamples = 3000;
        
        // Gradient Correction (Overlap region)
        this.overlapGradientSmoothness = -1;
        this.taperLength = 100;
        
        // Gradient Correction (Target image)
        this.targetGradientFlag = true;
        this.targetGradientSmoothness = 2;
        
        // Mosaic Star Mask
        this.limitMaskStarsPercent = 10;
        this.maskStarRadiusMult = 5;
        this.maskStarRadiusAdd = 2;
        
        // Create Mosaic
        this.mosaicOverlayTgtFlag = true;
        this.mosaicRandomFlag = false;
        this.mosaicAverageFlag = false;
        
        this.graphWidth = 1200; // gradient and photometry graph width
        this.graphHeight = 800; // gradient and photometry graph height
        
        // Set by '... Graph', 'Sample Grid', 'Create Mask' buttons
        this.testFlag = 0;
        
        this.cache = new MosaicCache();
        
    };

    // Used when the user presses the reset button
    this.resetParameters = function (photometricMosaicDialog) {
        // Reset the script's data
        this.setParameters();
        
        // Star Detection
        photometricMosaicDialog.starDetection_Control.setValue(this.logStarDetection);
        
        if (EXTRA_CONTROLS()){
            // Photometric Star Search
            photometricMosaicDialog.starFluxTolerance_Control.setValue(this.starFluxTolerance);
            photometricMosaicDialog.starSearchRadius_Control.setValue(this.starSearchRadius);
        }
        
        // Photometric Scale
        photometricMosaicDialog.limitPhotoStarsPercent_Control.setValue(this.limitPhotoStarsPercent);
        photometricMosaicDialog.linearRange_Control.setValue(this.linearRange);
        photometricMosaicDialog.outlierRemoval_Control.setValue(this.outlierRemoval);
        
        // Join Region
        photometricMosaicDialog.joinSize_Control.setValue(this.joinSize);
        photometricMosaicDialog.setHasJoinSize(this.hasJoinSize);
        
        // Join Region (Advanced settings)
        photometricMosaicDialog.setHasJoinAreaPreview(this.hasJoinAreaPreview);
        photometricMosaicDialog.rectangleX0_Control.setValue(this.joinAreaPreviewRect.x0);
        photometricMosaicDialog.rectangleY0_Control.setValue(this.joinAreaPreviewRect.y0);
        photometricMosaicDialog.rectangleWidth_Control.setValue(this.joinAreaPreviewRect.width);
        photometricMosaicDialog.rectangleHeight_Control.setValue(this.joinAreaPreviewRect.height);
        if (EXTRA_CONTROLS()){
            photometricMosaicDialog.taperFromJoin_Control.checked = this.taperFromJoin;
        }
        photometricMosaicDialog.cropTarget_Control.checked = this.cropTargetToJoinRegionFlag;
        
        // Gradient Sample Generation
        photometricMosaicDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        photometricMosaicDialog.sampleSize_Control.setValue(this.sampleSize);
        photometricMosaicDialog.sampleStarRadiusMult_Control.setValue(this.sampleStarRadiusMult);
        if (EXTRA_CONTROLS()){
            photometricMosaicDialog.maxSamples_Control.setValue(this.maxSamples);
        }
        
        // Gradient Correction (Overlap region)
        photometricMosaicDialog.overlapGradientSmoothness_Control.setValue(this.overlapGradientSmoothness);
        photometricMosaicDialog.taperLength_Control.setValue(this.taperLength);
        
        // Gradient Correction (Target image)
        photometricMosaicDialog.targetGradientSmoothness_Control.setValue(this.targetGradientSmoothness);
        photometricMosaicDialog.setTargetGradientFlag(this.targetGradientFlag);
        
        // Create Mosaic
        photometricMosaicDialog.mosaicOverlayTgt_Control.checked = this.mosaicOverlayTgtFlag;
        photometricMosaicDialog.mosaicRandom_Control.checked = this.mosaicRandomFlag;
        photometricMosaicDialog.mosaicAverage_Control.checked = this.mosaicAverageFlag;
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
    
    if (EXTRA_CONTROLS()){
        // Photometric Star Search
        Settings.write( KEYPREFIX+"/starFluxTolerance", DataType_Float, data.starFluxTolerance );
        Settings.write( KEYPREFIX+"/starSearchRadius", DataType_Float, data.starSearchRadius );
    }

    // Photometric Scale
    Settings.write( KEYPREFIX+"/limitPhotoStarsPercent", DataType_Float, data.limitPhotoStarsPercent );
    Settings.write( KEYPREFIX+"/linearRange", DataType_Float, data.linearRange );
    Settings.write( KEYPREFIX+"/outlierRemoval", DataType_Int32, data.outlierRemoval );

    // Join Region
    Settings.write( KEYPREFIX+"/joinSize", DataType_Int32, data.joinSize );
    
    // Gradient Sample Generation
    Settings.write( KEYPREFIX+"/limitSampleStarsPercent", DataType_Int32, data.limitSampleStarsPercent );
    Settings.write( KEYPREFIX+"/sampleSize", DataType_Int32, data.sampleSize );
    Settings.write( KEYPREFIX+"/sampleStarRadiusMult", DataType_Float, data.sampleStarRadiusMult );
    if (EXTRA_CONTROLS()){
        Settings.write( KEYPREFIX+"/maxSamples", DataType_Int32, data.maxSamples );
    }
   
    // Gradient Correction (Overlap region)
    Settings.write( KEYPREFIX+"/overlapGradientSmoothness", DataType_Float, data.overlapGradientSmoothness );
    Settings.write( KEYPREFIX+"/taperLength", DataType_Int32, data.taperLength );
    
    // Gradient Correction (Target image)
    Settings.write( KEYPREFIX+"/targetGradientFlag", DataType_Boolean, data.targetGradientFlag );
    Settings.write( KEYPREFIX+"/targetGradientSmoothness", DataType_Float, data.targetGradientSmoothness );
    
    // Mosaic Star Mask
    Settings.write( KEYPREFIX+"/limitMaskStarsPercent", DataType_Int32, data.limitMaskStarsPercent );
    Settings.write( KEYPREFIX+"/maskStarRadiusMult", DataType_Float, data.maskStarRadiusMult );
    Settings.write( KEYPREFIX+"/maskStarRadiusAdd", DataType_Float, data.maskStarRadiusAdd );
    
    // Create Mosaic
    Settings.write( KEYPREFIX+"/mosaicOverlayTgtFlag", DataType_Boolean, data.mosaicOverlayTgtFlag );
    Settings.write( KEYPREFIX+"/mosaicRandomFlag", DataType_Boolean, data.mosaicRandomFlag );
    Settings.write( KEYPREFIX+"/mosaicAverageFlag", DataType_Boolean, data.mosaicAverageFlag );
    
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
    
    if (EXTRA_CONTROLS()){
        // Photometric Star Search
        keyValue = Settings.read( KEYPREFIX+"/starFluxTolerance", DataType_Float );
        if ( Settings.lastReadOK )
            data.starFluxTolerance = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/starSearchRadius", DataType_Float );
        if ( Settings.lastReadOK )
            data.starSearchRadius;
    }
    
    // Photometric Scale
    keyValue = Settings.read( KEYPREFIX+"/limitPhotoStarsPercent", DataType_Float );
    if ( Settings.lastReadOK )
        data.limitPhotoStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/linearRange", DataType_Float );
    if ( Settings.lastReadOK )
        data.linearRange = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/outlierRemoval", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.outlierRemoval = keyValue;
    
    // Join Region
    keyValue = Settings.read( KEYPREFIX+"/joinSize", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.joinSize = keyValue;
    
    // Gradient Sample Generation
    keyValue = Settings.read( KEYPREFIX+"/limitSampleStarsPercent", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.limitSampleStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleSize", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.sampleSize = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/sampleStarRadiusMult", DataType_Float );
    if ( Settings.lastReadOK )
        data.sampleStarRadiusMult = keyValue;
    if (EXTRA_CONTROLS()){
        keyValue = Settings.read( KEYPREFIX+"/maxSamples", DataType_Int32 );
        if ( Settings.lastReadOK )
            data.maxSamples = keyValue;
    }
    
    // Gradient Correction (Overlap region)
    keyValue = Settings.read( KEYPREFIX+"/overlapGradientSmoothness", DataType_Float );
    if ( Settings.lastReadOK )
        data.overlapGradientSmoothness = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/taperLength", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.taperLength = keyValue;
    
    // Gradient Correction (Target image)
    keyValue = Settings.read( KEYPREFIX+"/targetGradientFlag", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.targetGradientFlag = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/targetGradientSmoothness", DataType_Float );
    if ( Settings.lastReadOK )
        data.targetGradientSmoothness = keyValue;
    
    // Mosaic Star Mask
    keyValue = Settings.read( KEYPREFIX+"/limitMaskStarsPercent", DataType_Int32 );
    if ( Settings.lastReadOK )
        data.limitMaskStarsPercent = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/maskStarRadiusMult", DataType_Float );
    if ( Settings.lastReadOK )
        data.maskStarRadiusMult = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/maskStarRadiusAdd", DataType_Float );
    if ( Settings.lastReadOK )
        data.maskStarRadiusAdd = keyValue;
    
    // Create Mosaic
    keyValue = Settings.read( KEYPREFIX+"/mosaicOverlayTgtFlag", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.mosaicOverlayTgtFlag = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/mosaicRandomFlag", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.mosaicRandomFlag = keyValue;
    keyValue = Settings.read( KEYPREFIX+"/mosaicAverageFlag", DataType_Boolean );
    if ( Settings.lastReadOK )
        data.mosaicAverageFlag = keyValue;
    
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
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            " &mdash; Corrects the scale and gradient between two registered images.</b><br />" +
            "(1) Each join should be approximately vertical or horizontal.<br />" +
            "(2) Join frames into either rows or columns.<br />" +
            "(3) Join these strips to create the final mosaic.<br />" +
            "Copyright &copy; 2019-2020 John Murphy");
    let titleSection = new Control(this);
    titleSection.sizer = new VerticalSizer;
    titleSection.sizer.add(titleLabel);
    titleSection.setMinSize(650, 60);
    let titleBar = new SectionBar(this, "Quick Start Guide");
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

    let referenceImage_Sizer = new HorizontalSizer(this);
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(referenceImage_ViewList, 100);

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
    if (data.targetView !== null){
        targetImage_ViewList.currentView = data.targetView;
    }
    targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer(this);
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(targetImage_ViewList, 100);
    
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
    let STAR_DETECTION_STR_LEN = this.font.width("Star detection:");
    this.starDetection_Control = new NumericControl(this);
    this.starDetection_Control.real = true;
    this.starDetection_Control.label.text = "Star detection:";
    this.starDetection_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.starDetection_Control.toolTip = "<p>Logarithm of the star detection " +
            "sensitivity. Increase this value to detect less stars.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starDetection_Control.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetection_Control.setPrecision(1);
    this.starDetection_Control.setRange(-2, 2);
    this.starDetection_Control.slider.setRange(0, 50);
    this.starDetection_Control.slider.minWidth = 50;
    this.starDetection_Control.setValue(data.logStarDetection);
    
    let detectedStarsButton = new PushButton(this);
    detectedStarsButton.text = "Detected stars";
    detectedStarsButton.toolTip =
            "<p>Displays all the stars detected in the reference and target images.</p>" +
            "<p>These stars are cached until either the Photometric Mosaic dialog " +
            "is closed or a modification invalidates the cache.</p>";
    detectedStarsButton.onClick = function () {
        data.viewFlag = DISPLAY_DETECTED_STARS();
        this.dialog.ok();
    };
    
    let starDetectionSection = new Control(this);
    starDetectionSection.sizer = new HorizontalSizer;
    starDetectionSection.sizer.add(this.starDetection_Control);
    starDetectionSection.sizer.addStretch();
    starDetectionSection.sizer.add(detectedStarsButton);
    let starDetectionBar = new SectionBar(this, "Star Detection");
    starDetectionBar.setSection(starDetectionSection);
    starDetectionBar.onToggleSection = this.onToggleSection;
    starDetectionBar.toolTip = "<p>Star detection sensitivity.</p>" +
            "<p>The default settings usually work well.</p>";
    // SectionBar "Star Detection" End
    
    let photometrySearchSection;
    let photometrySearchBar;
    if (EXTRA_CONTROLS()){
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
                "the wrong star or even matching noise.</p>" +
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
        photometrySearchBar = new SectionBar(this, "Photometric Star Search");
        photometrySearchBar.setSection(photometrySearchSection);
        photometrySearchBar.onToggleSection = this.onToggleSection;
        photometrySearchBar.toolTip = "<p>Search criteria used to match reference and target stars.</p>" +
                "<p>The default settings usually work well.</p>";
        // SectionBar: "Photometric Star Search" End
    }
    
    // =======================================
    // SectionBar: "Photometric Scale"
    // =======================================
    this.limitPhotoStarsPercent_Control = new NumericEdit(this);
    this.limitPhotoStarsPercent_Control.setReal(true);
    this.limitPhotoStarsPercent_Control.label.text = "Limit stars %:";
    this.limitPhotoStarsPercent_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.limitPhotoStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of detected stars used for photometry. " +
            "The faintest stars are rejected.</p>" +
            "<p>100% implies that all detected stars are used, up to a maximum of 1000.</p>" +
            "<p>90% implies that the faintest 10% of detected stars are rejected.</p>" +
            "<p>0% implies no stars will be used. The scale will default to one.</p>";
    this.limitPhotoStarsPercent_Control.setPrecision(2);
    this.limitPhotoStarsPercent_Control.setRange(0, 100);
    this.limitPhotoStarsPercent_Control.setValue(data.limitPhotoStarsPercent);
    this.limitPhotoStarsPercent_Control.onValueUpdated = function (value){
        data.limitPhotoStarsPercent = value;
    };
    
    let LINEAR_RANGE_STRLEN = this.font.width("Linear range:");
    this.linearRange_Control = new NumericEdit(this);
    this.linearRange_Control.setReal(true);
    this.linearRange_Control.label.text = "Linear range:";
    this.linearRange_Control.label.minWidth = LINEAR_RANGE_STRLEN;
    this.linearRange_Control.toolTip =
            "<p>Restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value.</p>" +
            "<p>Use this to reject stars that are outside the " +
            "camera's linear response range.</p>";
    this.linearRange_Control.setPrecision(3);
    this.linearRange_Control.setRange(0.001, 1.0);
    this.linearRange_Control.setValue(data.linearRange);
    this.linearRange_Control.onValueUpdated = function (value){
        data.linearRange = value;
    };
    
    this.outlierRemoval_Control = new NumericEdit(this);
    this.outlierRemoval_Control.setReal(false);
    this.outlierRemoval_Control.label.text = "Outlier removal:";
    this.outlierRemoval_Control.toolTip =
            "<p>Number of outlier stars to remove.</p>" +
            "<p>Outliers can be due to variable stars, or measurement issues.</p>" +
            "<p>Removing a few outliers can improve accuracy, but don't over do it.</p>";
    this.outlierRemoval_Control.setRange(0, 50);
    this.outlierRemoval_Control.setValue(data.outlierRemoval);
    this.outlierRemoval_Control.onValueUpdated = function (value){
        data.outlierRemoval = value;
    };
    
    let photometryGraphButton = new PushButton(this);
    photometryGraphButton.text = "Edit and display graph";
    photometryGraphButton.toolTip =
            "<p>Edit parameters and view a graph of the linear fit in real time.</p>" +
            "<p>For each star detected within the overlap region, " +
            "provided the star meets the photometry criteria, the star's reference flux " +
            "is plotted against its target flux (arbitary units).</p>" +
            "<p>The best fit lines are drawn through the points. " +
            "Their gradient determines the scale factor for each color. </p>" +
            "<p>Color (red, green and blue) is used to represent the data for each color channel.</p>";
    photometryGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_PHOTOMETRY_GRAPH();
        this.dialog.ok();
    };
    
    let photometricScaleHorizSizer1 = new HorizontalSizer(this);
    photometricScaleHorizSizer1.spacing = 10;
    photometricScaleHorizSizer1.add(this.limitPhotoStarsPercent_Control);
    photometricScaleHorizSizer1.add(this.linearRange_Control);
    photometricScaleHorizSizer1.add(this.outlierRemoval_Control);
    photometricScaleHorizSizer1.addStretch();
    photometricScaleHorizSizer1.add(photometryGraphButton);
    
    let photometrySection = new Control(this);
    photometrySection.sizer = new VerticalSizer;
    photometrySection.sizer.spacing = 4;
    photometrySection.sizer.add(photometricScaleHorizSizer1);
    if (EXTRA_CONTROLS()){
        let photometryStarsButton = new PushButton(this);
        photometryStarsButton.text = "Photometry stars";
        photometryStarsButton.toolTip =
                "<p>Displays the stars that met the criteria for photometry, including: " +
                "<ul><li>Found in both target and reference images.</li>" +
                "<li>Amongst the brightest 'Limit stars %' stars.</li>" +
                "<li>Within the specified 'Linear range'.</li>" +
                "<li>Not rejected by 'Outlier removal'.</li></ul></p>";
        photometryStarsButton.onClick = function () {
            data.viewFlag = DISPLAY_PHOTOMETRY_STARS();
            this.dialog.ok();
        };
        let photometricScaleHorizSizer2 = new HorizontalSizer;
        photometricScaleHorizSizer2.addStretch();
        photometricScaleHorizSizer2.add(photometryStarsButton);
        photometrySection.sizer.add(photometricScaleHorizSizer2);
    }
    let photometryBar = new SectionBar(this, "Photometric Scale");
    photometryBar.setSection(photometrySection);
    photometryBar.onToggleSection = this.onToggleSection;
    photometryBar.toolTip = "<p>Determines the photometry stars used " +
            " to calculate the brightness scale factor.</p>" +
            "<p>Display the 'Photometry graph' and check for outliers to the " +
            "best fit line.</p>";
    // SectionBar: "Photometric Scale" End

    // =======================================
    // SectionBar: "Gradient Sample Generation"
    // =======================================
    const sampleGenerationStrLen = this.font.width("Multiply star radius:");
    
    this.limitSampleStarsPercent_Control = new NumericEdit(this);
    this.limitSampleStarsPercent_Control.real = true;
    this.limitSampleStarsPercent_Control.label.text = "Limit stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.limitSampleStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars. This is " +
            "OK provided that no star takes up more than half of a sample's area.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. This can affect how many of the " +
            "pixels illuminated by a star fall into a neighboring sample.</li></ul>" +
            "<p>It is only necessary to reject bright stars. This script uses the " +
            "median value from each sample, so any star that takes up less than " +
            "half the sample area will have little effect. It is more important to " +
            "include most of the samples than to reject faint stars.</p>";
    this.limitSampleStarsPercent_Control.setPrecision(2);
    this.limitSampleStarsPercent_Control.setRange(0, 100);
    this.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);        
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    
    this.sampleStarRadiusMult_Control = new NumericEdit(this);
    this.sampleStarRadiusMult_Control.real = true;
    this.sampleStarRadiusMult_Control.label.text = "Multiply star radius:";
    this.sampleStarRadiusMult_Control.toolTip =
            "<p>Increase to reject more samples around saturated stars.</p>" +
            "<p>Read the Help sections on 'Join Region' to learn when these " +
            "samples should be rejected.</p>";
    this.sampleStarRadiusMult_Control.setPrecision(1);
    this.sampleStarRadiusMult_Control.setRange(1, 25);
    this.sampleStarRadiusMult_Control.setValue(data.sampleStarRadiusMult);     
    this.sampleStarRadiusMult_Control.onValueUpdated = function (value){
        data.sampleStarRadiusMult = value;
    };
    
    this.sampleSize_Control = new NumericEdit(this);
    this.sampleSize_Control.real = false;
    this.sampleSize_Control.label.text = "Sample size:";
    this.sampleSize_Control.label.minWidth = LINEAR_RANGE_STRLEN;
    this.sampleSize_Control.toolTip =
            "<p>Specifies the size of the sample squares.</p>" +
            "<p>The sample size should be greater than 2x the size of the largest " +
            "star that's not rejected by 'Limit stars %'.</p>";
    this.sampleSize_Control.setRange(2, 50);
    this.sampleSize_Control.setValue(data.sampleSize);
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    
    let displaySamplesButton = new PushButton(this);
    displaySamplesButton.text = "Edit and display samples";
    displaySamplesButton.toolTip =
            "<p>Edit parameters and view the grid of samples in real time.</p>" +
            "<p>A surface spline is constructed from these samples to " +
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
    
    let sampleGridSizer = new HorizontalSizer(this);
    sampleGridSizer.spacing = 10;
    sampleGridSizer.add(this.limitSampleStarsPercent_Control);
    sampleGridSizer.add(this.sampleSize_Control);
    sampleGridSizer.add(this.sampleStarRadiusMult_Control);
    sampleGridSizer.addStretch();
    sampleGridSizer.add(displaySamplesButton);
    
    let maxSamplesSizer;
    if (EXTRA_CONTROLS()){
        this.maxSamples_Control = new NumericEdit(this);
        this.maxSamples_Control.real = false;
        this.maxSamples_Control.label.text = "Max samples:";
        this.maxSamples_Control.label.minWidth = this.font.width("Limit stars %:");
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
    sampleGenerationSection.sizer.add(sampleGridSizer);
    if (EXTRA_CONTROLS()){
        sampleGenerationSection.sizer.add(maxSamplesSizer);
    }
    let sampleGenerationBar = new SectionBar(this, "Gradient Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = 
            "<p>This section generates samples used to construct a surface spline " +
            "that models the relative gradient between the reference and target pixels " +
            "within the overlap region.</p>" +
            "<p>The overlap region is divided up into a grid of sample squares. " +
            "A sample's value is the median of the pixels it contains.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they are too close to a bright star.</p>" +
            "<p>The surface spline resolution will depend on the sample size, " +
            "how noisy each sample is, and how much smoothing is applied.</p>";
    // SectionBar: "Gradient Sample Generation" End

    // ==================================================
    // SectionBar: "Gradient Correction (Overlap region)"
    // ==================================================
    // Gradient controls
    this.overlapGradientSmoothness_Control = new NumericControl(this);
    this.overlapGradientSmoothness_Control.real = true;
    this.overlapGradientSmoothness_Control.setPrecision(1);
    this.overlapGradientSmoothness_Control.label.text = "Smoothness:";
    this.overlapGradientSmoothness_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.overlapGradientSmoothness_Control.toolTip =
        "<p>A surface spline is created to model the relative " +
        "gradient over the whole of the overlap region.</p>" +
        "<p>Smoothing needs to be applied to this surface spline to ensure it follows " +
        "the gradient but not the noise.</p>" +
        "<p>This control specifies the logarithm of the smoothness. " +
        "Larger values apply more smoothing.</p>";
    this.overlapGradientSmoothness_Control.onValueUpdated = function (value) {
        data.overlapGradientSmoothness = value;
    };
    this.overlapGradientSmoothness_Control.setRange(-4, 3);
    this.overlapGradientSmoothness_Control.slider.setRange(-400, 300);
    this.overlapGradientSmoothness_Control.slider.minWidth = 140;
    this.overlapGradientSmoothness_Control.setValue(data.overlapGradientSmoothness);
    
    let overlapGradientGraphButton = new PushButton(this);
    overlapGradientGraphButton.text = "Edit and display gradient";
    overlapGradientGraphButton.toolTip =
        "<p>Edit the 'Smoothness' parameter and view the gradient along the join.</p>" +
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent samples close to the join path.</p>" +
        "<p>The curve shows the gradient along the path of the join. " +
        "This path follows the center line of the join region's bounding box, " +
        "or the boundary of the overlapping pixels if the center line leaves the " +
        "overlap.</p>" +
        "<p>The join path can be displayed within the 'Gradient Sample Generation' dialog.</p>";
    overlapGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_OVERLAP_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    let taperTooltip = "<p>The gradient within the overlap region can be accurately " +
        "calculated, and only requires a small amount of smoothing to remove noise.</p>" +
        "<p>The gradient over the rest of the target frame is only an estimate, so " +
        "it is normal to apply a greater level of smoothing to this region " +
        "(see 'Gradient Correction (Target image)' section).</p>" +
        "<p>The taper length provides a tapered transition between these two different " +
        "levels of smoothing. This transition zone is in the Target image area, " +
        "starting from the edge of the overlap's bounding box.</p>";
    
    this.taperLength_Control = new NumericControl(this);
    this.taperLength_Control.real = false;
    this.taperLength_Control.label.text = "Taper length:";
    this.taperLength_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.taperLength_Control.toolTip = taperTooltip;
    this.taperLength_Control.onValueUpdated = function (value) {
        data.taperLength = value;
    };
    this.taperLength_Control.setRange(0, 500);
    this.taperLength_Control.slider.setRange(0, 500);
    this.taperLength_Control.slider.minWidth = 500;
    this.taperLength_Control.setValue(data.taperLength);
    
    let overlapGradientSizer = new HorizontalSizer(this);
    overlapGradientSizer.spacing = 4;
    overlapGradientSizer.add(this.overlapGradientSmoothness_Control);
    overlapGradientSizer.addSpacing(20);
    overlapGradientSizer.add(overlapGradientGraphButton);
    
    let overlapGradientSection = new Control(this);
    overlapGradientSection.sizer = new VerticalSizer(this);
    overlapGradientSection.sizer.spacing = 4;
    overlapGradientSection.sizer.add(overlapGradientSizer);
    overlapGradientSection.sizer.add(this.taperLength_Control);
    let gradientBar = new SectionBar(this, "Gradient Correction (Overlap region)");
    gradientBar.setSection(overlapGradientSection);
    gradientBar.onToggleSection = this.onToggleSection;
    gradientBar.toolTip = "<p>A surface spline is created to model the relative " +
            "gradient over the whole of the overlap region.</p>" +
            "<p>Smoothing is applied to this surface spline to ensure it follows " +
            "the gradient but not the noise.</p>";
    //SectionBar: "Gradient Correction" End
    
    // ===============================================
    // SectionBar: "Gradient Correction (Target image)"
    // ===============================================
    this.targetGradientSmoothness_Control = new NumericControl(this);
    this.targetGradientSmoothness_Control.real = true;
    this.targetGradientSmoothness_Control.setPrecision(1);
    this.targetGradientSmoothness_Control.label.text = "Smoothness:";
    this.targetGradientSmoothness_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.targetGradientSmoothness_Control.toolTip =
        "<p>The target image gradient correction is determined from the gradient " +
        "along the target side edge of the Overlap's bounding box.</p>" +
        "<p>However, this gradient will contain local variations " +
        "(e.g. diffuse light around bright stars) that should not " +
        "be extrapolated across the target image.</p>" +
        "<p>Sufficient Smoothness should be applied to ensure that the " +
        "gradient correction only follows the gradient trend, rather than " +
        "these local variations.</p>" +
        "<p>This control specifies the logarithm of the smoothness. " +
        "Larger values apply more smoothing.</p>";
    this.targetGradientSmoothness_Control.onValueUpdated = function (value) {
        data.targetGradientSmoothness = value;
    };
    this.targetGradientSmoothness_Control.setRange(-2, 5);
    this.targetGradientSmoothness_Control.slider.setRange(-100, 600);
    this.targetGradientSmoothness_Control.slider.minWidth = 140;
    this.targetGradientSmoothness_Control.setValue(data.targetGradientSmoothness);
    
    let targetGradientGraphButton = new PushButton(this);
    targetGradientGraphButton.text = "Edit and display gradient";
    targetGradientGraphButton.toolTip =
        "<p>Edit the 'Smoothness' parameter and view the gradient that will be " +
        "applied to the rest of the target image (i.e. outside the overlap region).</p>" +
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the join's X-Coordinate (horizontal join) " +
        "or Y-Coordinate (vertical join).</p>" +
        "<p>The plotted dots represent samples close to the target side boundary of the " +
        "overlapping pixels.</p>" +
        "<p>The curve shows the gradient correction that will be applied to the target image.</p>";
    targetGradientGraphButton.onClick = function () {
        data.viewFlag = DISPLAY_TARGET_GRADIENT_GRAPH();
        this.dialog.ok();
    };
    
    this.setTargetGradientFlag = function (checked){
        data.targetGradientFlag = checked;
        self.targetGradientBar.checkBox.checked = checked;
        self.targetGradientSmoothness_Control.enabled = checked;
        targetGradientGraphButton.enabled = checked;
    };
    
    let targetGradientSection = new Control(this);
    targetGradientSection.sizer = new HorizontalSizer;
    targetGradientSection.sizer.spacing = 10;
    targetGradientSection.sizer.add(this.targetGradientSmoothness_Control);
    targetGradientSection.sizer.addSpacing(20);
    targetGradientSection.sizer.add(targetGradientGraphButton);
    this.targetGradientBar = new SectionBar(this, "Gradient Correction (Target image)");
    this.targetGradientBar.setSection(targetGradientSection);
    this.targetGradientBar.enableCheckBox();
    this.targetGradientBar.toolTip = 
            "<p>If selected, a gradient correction is applied " +
            "to the rest of the target image (i.e. outside the overlap region).</p>" +
            "<p>If not selected, only the average background offset is applied.</p>" +
            "<p>In most situations, this option should be selected.</p>";
    this.targetGradientBar.checkBox.onClick = this.setTargetGradientFlag;
    this.targetGradientBar.onToggleSection = this.onToggleSection;
    this.setTargetGradientFlag(data.targetGradientFlag);
    // SectionBar: "Propagated Gradient Correction" End

    // ===========================================
    // SectionBar: Join Region (Advanced settings)
    // ============================================
    const getAreaFromPreviewStr = "From preview:";
    const GET_AREA_FROM_PREVIEW_STRLEN = this.font.width(getAreaFromPreviewStr);
    const JoinRegionTooltip =
            "<p>This section provides total control over the Join Region.</p>" +
            "<p>The Join Region is based on a user specified rectangle. This can " +
            "be entered directly, or specified by a Preview. The Join Region is " +
            "created by extending this rectangle to cover the full length of the join.</p>" +
            "<p>Aim to make the Join Region thin and close to the center of the " +
            "overlap (away from image corners), " +
            "but try to avoid bright stars and star halos.</p>" +
            "For more information on how to use a Join Region, read the Help sections:" +
            "<ul><li>Join Region: Taking control of the join</li>" +
            "<li>Join Region: Avoiding bright star artifacts</li></ul></p>";
            
    let x0ToolTip = "X-coordinate of Join Region's top left corner";
    this.rectangleX0_Control = createNumericEdit("Left:", x0ToolTip,
            data.joinAreaPreviewRect.x0, 50);
    this.rectangleX0_Control.label.setFixedWidth(
            this.font.width("Left:") + GET_AREA_FROM_PREVIEW_STRLEN + 4);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    let y0ToolTip = "Y-coordinate of Join Region's top left corner";
    this.rectangleY0_Control = createNumericEdit("Top:", y0ToolTip,
            data.joinAreaPreviewRect.y0, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    this.rectangleWidth_Control = createNumericEdit("Width:", "Join Region width",
            data.joinAreaPreviewRect.width, 50);
    this.rectangleWidth_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    this.rectangleHeight_Control = createNumericEdit("Height:", "Join Region height",
            data.joinAreaPreviewRect.height, 50);
    this.rectangleHeight_Control.onValueUpdated = function (value){
        data.joinAreaPreviewRect = getJoinAreaPreviewRect();
    };
    
    function getJoinAreaPreviewRect(){
        let x = self.rectangleX0_Control.value;
        let y = self.rectangleY0_Control.value;
        let w = self.rectangleWidth_Control.value;
        let h = self.rectangleHeight_Control.value;
        return new Rect(x, y, x + w, y + h);
    }

    let joinAreaHorizSizer1 = new HorizontalSizer(this); 
    joinAreaHorizSizer1.spacing = 10;
    joinAreaHorizSizer1.add(this.rectangleX0_Control);
    joinAreaHorizSizer1.add(this.rectangleY0_Control);
    joinAreaHorizSizer1.add(this.rectangleWidth_Control);
    joinAreaHorizSizer1.add(this.rectangleHeight_Control);
    joinAreaHorizSizer1.addStretch();

    function previewUpdateActions(dialog){
        let view = dialog.previewImage_ViewList.currentView;
        if (view !== null && view.isPreview) {
            dialog.joinAreaBar.checkBox.checked = data.hasJoinAreaPreview;
            data.joinAreaPreviewRect = view.window.previewRect(view);
            dialog.rectangleX0_Control.setValue(data.joinAreaPreviewRect.x0);
            dialog.rectangleY0_Control.setValue(data.joinAreaPreviewRect.y0);
            dialog.rectangleWidth_Control.setValue(data.joinAreaPreviewRect.width);
            dialog.rectangleHeight_Control.setValue(data.joinAreaPreviewRect.height);
            
            dialog.setHasJoinAreaPreview(true);
        } else {
            dialog.setHasJoinAreaPreview(false);
        }
    };

    // Get Area from preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = getAreaFromPreviewStr;
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Initialize the 'Join Region' from a preview.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        previewUpdateActions(this.dialog);
    };

    let previewUpdateButton = new PushButton(this);
    previewUpdateButton.hasFocus = false;
    previewUpdateButton.text = "Update";
    previewUpdateButton.onClick = function () {
        if (!this.isUnderMouse){
            // Ensure pressing return in a different field does not trigger this callback!
            return;
        }
        previewUpdateActions(this.dialog);
    };

    let joinAreaHorizSizer2 = new HorizontalSizer(this);
    joinAreaHorizSizer2.spacing = 4;
    joinAreaHorizSizer2.add(previewImage_Label);
    joinAreaHorizSizer2.add(this.previewImage_ViewList, 100);
    joinAreaHorizSizer2.addSpacing(10);
    joinAreaHorizSizer2.add(previewUpdateButton);
    
    this.setHasJoinAreaPreview = function(checked){
        data.hasJoinAreaPreview = checked;
        self.joinAreaBar.checkBox.checked = checked;
        self.rectangleX0_Control.enabled = checked;
        self.rectangleWidth_Control.enabled = checked;
        self.rectangleY0_Control.enabled = checked;
        self.rectangleHeight_Control.enabled = checked;
        self.cropTarget_Control.enabled = checked;
        if (checked){
            self.setHasJoinSize(false);
        } else {
            data.cropTargetToJoinRegionFlag = false;
            self.cropTarget_Control.checked = false; 
        }
        if (EXTRA_CONTROLS()){
            self.taperFromJoin_Control.enabled = checked;
            if (!checked){
                data.taperFromJoin = false;
                self.taperFromJoin_Control.checked = false;
            }
        }
    };
    
    if (EXTRA_CONTROLS()){
        this.taperFromJoin_Control = new CheckBox(this);
        this.taperFromJoin_Control.text = "Taper from join";
        this.taperFromJoin_Control.toolTip =
                "<p>This is an advanced option and should usually be left unchecked.</p>" +
                "<p>This option moves the taper from the target side of the " +
                "Overlap bounding box to the target side of the Join Region.</p>" +
                "<p>The target image's offset and gradient are fully corrected within the join region, " +
                "but outside the Overlap bounding box the gradient can only be partially " +
                "corrected. A taper is applied to blend these two regions together.</p>" +
                "<p>This option is one of several strategies used to prevent a bright star " +
                "near the start of the taper zone from causing a bright or dark shadow " +
                "within the zone.</p>" +
                "To learn more about the available strategies, read the Help sections:" +
                "<ul><li>Join Region: Taking control of the join</li>" +
                "<li>Join Region: Avoiding bright star artifacts</li></ul></p>";

        this.taperFromJoin_Control.onCheck = function (checked){
            data.taperFromJoin = checked;
        };
        this.taperFromJoin_Control.checked = data.taperFromJoin;
    }
    
    this.cropTarget_Control = new CheckBox(this);
    this.cropTarget_Control.text = "Crop target";
    this.cropTarget_Control.toolTip = 
        "<p>Restricts target image pixels to the user specified rectangle. " +
        "All target pixels outside this rectangle are ignored.</p>" +
        "<p>This can be used to fix a small area of the mosaic or to add a high res image to a wider mosaic.</p>" +
        "<p>This option only supports the mosaic combination modes 'Overlay' and 'Average'.</p>";
    this.cropTarget_Control.onCheck = function (checked){
        data.cropTargetToJoinRegionFlag = checked;
    };
    this.cropTarget_Control.checked = data.cropTargetToJoinRegionFlag;
    
    let joinAreaFlagsHorizSizer = new HorizontalSizer(this);
    joinAreaFlagsHorizSizer.addSpacing(GET_AREA_FROM_PREVIEW_STRLEN + 4);
    joinAreaFlagsHorizSizer.add(this.cropTarget_Control);
    if (EXTRA_CONTROLS()){
        joinAreaFlagsHorizSizer.addSpacing(20);
        joinAreaFlagsHorizSizer.add(this.taperFromJoin_Control);
    }
    
    joinAreaFlagsHorizSizer.addStretch();
    
    let joinAreaSection = new Control(this);
    joinAreaSection.sizer = new VerticalSizer(this);
    joinAreaSection.sizer.spacing = 4;
    joinAreaSection.sizer.add(joinAreaHorizSizer1);
    joinAreaSection.sizer.add(joinAreaHorizSizer2);
    joinAreaSection.sizer.add(joinAreaFlagsHorizSizer);
    this.joinAreaBar = new SectionBar(this, "Join Region (Advanced settings)");
    this.joinAreaBar.setSection(joinAreaSection);
    this.joinAreaBar.enableCheckBox();
    this.joinAreaBar.toolTip = JoinRegionTooltip;
    this.joinAreaBar.checkBox.onClick = this.setHasJoinAreaPreview;
    this.joinAreaBar.onToggleSection = this.onToggleSection;
    // SectionBar "Join Region" End

    // =======================================
    // SectionBar: "Join Region"
    // =======================================
    let joinSizeTooltip = 
        "<p>Limits the Join Region to a long thin rectangle that is centered within the overlap region.</p>" +
        "<p>In most cases this option produces excellent results.</p>" +
        "<p>For more information on how to use a Join Region, read the Help sections:" +
        "<ul><li>Join Region: Taking control of the join</li>" +
        "<li>Join Region: Avoiding bright star artifacts</li></ul></p>";

    this.joinSize_Control = new NumericControl(this);
    this.joinSize_Control.real = false;
    this.joinSize_Control.label.text = "Join size:";
    this.joinSize_Control.label.minWidth = STAR_DETECTION_STR_LEN;
    this.joinSize_Control.toolTip = "<p>Specifies the thickness of the Join Region. " +
            "For a horizontal join, this is the height. For a vertical join, the width. " +
            "The ideal Join size depends on the Mosaic Combination mode:" +
            "<ul><li>Overlay: The join runs along the middle of the Join Region. " +
            "Join size is ignored.</li>" +
            "<li>Random: Join size should be large enough to blend the two images " +
            "together, but small enough not to include too many stars.</li>" +
            "<li>Average: Determines the area that will benefit from a higher " +
            "signal to noise ratio.</li></ul></p>";
            
    this.joinSize_Control.onValueUpdated = function (value) {
        data.joinSize = value;
    };
    this.joinSize_Control.setRange(1, 250);
    this.joinSize_Control.slider.setRange(1, 250);
    this.joinSize_Control.slider.minWidth = 250;
    this.joinSize_Control.setValue(data.joinSize);
    
    this.setHasJoinSize = function(checked){
        if (checked){
            self.setHasJoinAreaPreview(false);
        }
        data.hasJoinSize = checked;
        self.joinSizeBar.checkBox.checked = checked;
        self.joinSize_Control.enabled = checked;
    };
    
    let joinSizeSection = new Control(this);
    joinSizeSection.sizer = new VerticalSizer;
    joinSizeSection.sizer.spacing = 4;
    joinSizeSection.sizer.add(this.joinSize_Control);
    this.joinSizeBar = new SectionBar(this, "Join Region");
    this.joinSizeBar.setSection(joinSizeSection);
    this.joinSizeBar.enableCheckBox();
    this.joinSizeBar.toolTip = joinSizeTooltip;
    this.joinSizeBar.checkBox.onClick = this.setHasJoinSize;
    this.joinSizeBar.onToggleSection = this.onToggleSection;
    this.setHasJoinSize(data.hasJoinSize);
    this.setHasJoinAreaPreview(data.hasJoinAreaPreview); 
    // SectionBar "Join Region" End


    // =======================================
    // SectionBar: "Create Mosaic"
    // =======================================
    let overlay_Label = new Label(this);
    overlay_Label.text = "Combination mode:";
    overlay_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    overlay_Label.minWidth = this.font.width("Overlay:");
    
    this.mosaicOverlayTgt_Control = new RadioButton(this);
    this.mosaicOverlayTgt_Control.text = "Overlay";
    this.mosaicOverlayTgt_Control.toolTip =
            "The Join Region is divided in half along its length:" +
            "<ul><li>On the target side, target pixels are drawn on top.</li>" +
            "<li>On the reference side, reference pixels " +
            "are drawn on top.</li></ul>" +
            "<p>For a pure 'target overlay' or 'reference overlay', create " +
            "a Join Region at one side of the overlap region.</p>";
    this.mosaicOverlayTgt_Control.checked = data.mosaicOverlayTgtFlag;
    this.mosaicOverlayTgt_Control.onClick = function (checked) {
        data.mosaicOverlayTgtFlag = checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };

    this.mosaicRandom_Control = new RadioButton(this);
    this.mosaicRandom_Control.text = "Random";
    this.mosaicRandom_Control.toolTip = "<p>Over the join region, pixels " +
            "are randomly chosen from the reference and target images.</p>" +
            "<p>This mode is particularly effective at hiding the join, but if " +
            "the star profiles in the reference and target images don't match, " +
            "this can lead to speckled pixels around the stars.</p>" +
            "<p>These speckled star artifacts can be fixed by using PixelMath " +
            "to apply either the reference or target image to the mosaic through " +
            "a mask that only reveals the bright stars. The 'Mosaic Star Mask' " +
            "section has been provided for this purpose.</p>";
    this.mosaicRandom_Control.checked = data.mosaicRandomFlag;
    this.mosaicRandom_Control.onClick = function (checked) {
        data.mosaicRandomFlag = checked;
        data.mosaicOverlayTgtFlag = !checked;
        data.mosaicAverageFlag = !checked;
    };
    this.mosaicAverage_Control = new RadioButton(this);
    this.mosaicAverage_Control.text = "Average";
    this.mosaicAverage_Control.toolTip = "<p>Over the join region, " +
            "pixels are set to the average of the reference and target pixels.</p>" +
            "<p>This mode has the advantage of increasing the signal to noise ratio " +
            "over the join, but this can also make the join more visible.</p>";
    this.mosaicAverage_Control.checked = data.mosaicAverageFlag;
    this.mosaicAverage_Control.onClick = function (checked) {
        data.mosaicAverageFlag = checked;
        data.mosaicRandomFlag = !checked;
        data.mosaicOverlayTgtFlag = !checked;
    };
    
    
    let starsMaskButton = new PushButton(this);
    starsMaskButton.text = "Star mask";
    starsMaskButton.toolTip =
            "<p>Creates a star mask.</p>" + 
            "<p>The 'Random' combine mode can leave speckle artifacts around stars. " +
            "The generated mask can be used to replace these stars with stars " +
            "from the reference frame (Do NOT use the target frame).</p>" +
            "<p>The required Pixel Math expression is simply the name of the reference image.</p>";
    starsMaskButton.onClick = function () {
        data.viewFlag = DISPLAY_MOSAIC_MASK_STARS();
        this.dialog.ok();
    };
    
    let joinMaskButton = new PushButton(this);
    joinMaskButton.text = "Join mask";
    joinMaskButton.toolTip =
            "<p>Creates a mask of the mosaic join. " +
            "This mask indicates the pixels used to create the mosaic join.</p>" +
            "<p>If the mask extends into the 'black', this indicates this area " +
            "is slightly above zero. To correct, use Pixel Math expression similar to:</p>" +
            "<p>iif($T &lt; 0.0005, 0, $T)</p>" +
            "<p>If a 'Join Region' has not been defined, the join area is " +
            "simply the overlapping pixels. However, if it has been specified, " +
            "the join extends along the full length of the join but it is " +
            "otherwise limited to the 'Join Region'.</p>";
    joinMaskButton.onClick = function () {
        data.viewFlag = CREATE_JOIN_MASK();
        this.dialog.ok();
    };
    
    let mosaicSection = new Control(this);
    mosaicSection.sizer = new HorizontalSizer(this);
    mosaicSection.sizer.spacing = 10;
    mosaicSection.sizer.add(overlay_Label);
    mosaicSection.sizer.add(this.mosaicOverlayTgt_Control);
    mosaicSection.sizer.add(this.mosaicRandom_Control);
    mosaicSection.sizer.add(this.mosaicAverage_Control);
    mosaicSection.sizer.addStretch();
    mosaicSection.sizer.add(starsMaskButton);
    mosaicSection.sizer.spacing = 6;
    mosaicSection.sizer.add(joinMaskButton);
    this.mosaicBar = new SectionBar(this, "Create Mosaic");
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
    
    let okTooltip = "<p>Applies the calculated scale and gradient to a copy of the target image.</p>" +
            "<p>If 'Create Mosaic' is selected, a mosaic image is created and displayed.</p>";

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
    if (EXTRA_CONTROLS()){
        this.sizer.add(photometrySearchBar);
        this.sizer.add(photometrySearchSection);
        photometrySearchSection.hide();
    }
    this.sizer.add(photometryBar);
    this.sizer.add(photometrySection);
    this.sizer.add(this.joinSizeBar);
    this.sizer.add(joinSizeSection);
    this.sizer.add(this.joinAreaBar);
    this.sizer.add(joinAreaSection);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(gradientBar);
    this.sizer.add(overlapGradientSection);
    this.sizer.add(this.targetGradientBar);
    this.sizer.add(targetGradientSection);
    this.sizer.add(this.mosaicBar);
    this.sizer.add(mosaicSection);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);
    
    joinSizeSection.hide();
    joinAreaSection.hide();

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

//-------------------------------------------------------
// Photometry Stars Controls
//-------------------------------------------------------
function createLimitPhotoStarsPercentControl(dialog, data, strLength){
    let limitPhotoStarsPercent_Control = new NumericControl(dialog);
    limitPhotoStarsPercent_Control.real = true;
    limitPhotoStarsPercent_Control.label.text = "Limit stars %:";
    limitPhotoStarsPercent_Control.label.minWidth = strLength;
    limitPhotoStarsPercent_Control.toolTip =
            "<p>Specifies the percentage of detected stars used for photometry. " +
            "The faintest stars are rejected.</p>" +
            "<p>100% implies that all detected stars are used, up to a maximum of 1000.</p>" +
            "<p>90% implies that the faintest 10% of detected stars are rejected.</p>" +
            "<p>0% implies no stars will be used. The scale will default to one.</p>";
    limitPhotoStarsPercent_Control.setRange(0, 100);
    limitPhotoStarsPercent_Control.slider.setRange(0, 200);
    limitPhotoStarsPercent_Control.setPrecision(2);
    limitPhotoStarsPercent_Control.slider.minWidth = 200;
    limitPhotoStarsPercent_Control.setValue(data.limitPhotoStarsPercent);
    return limitPhotoStarsPercent_Control;
}

function createLinearRangeControl(dialog, data, strLength){
    let linearRange_Control = new NumericControl(dialog);
    linearRange_Control.real = true;
    linearRange_Control.label.text = "Linear range:";
    linearRange_Control.label.minWidth = strLength;
    linearRange_Control.toolTip =
            "<p>Restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value.</p>" +
            "<p>Use this to reject stars that are outside the " +
            "camera's linear response range.</p>";
    linearRange_Control.setRange(0.001, 1.0);
    linearRange_Control.slider.setRange(0, 500);
    linearRange_Control.setPrecision(3);
    linearRange_Control.slider.minWidth = 200;
    linearRange_Control.setValue(data.linearRange);
    return linearRange_Control;
}

function createOutlierRemovalControl(dialog, data, strLength){
    let outlierRemoval_Control = new NumericControl(dialog);
    outlierRemoval_Control.real = false;
    outlierRemoval_Control.label.text = "Outlier removal:";
    outlierRemoval_Control.label.minWidth = strLength;
    outlierRemoval_Control.toolTip =
            "<p>Number of outlier stars to remove.</p>" +
            "<p>Outliers can be due to variable stars, or measurement issues.</p>" +
            "<p>Removing a few outliers can improve accuracy, but don't over do it.</p>";
    outlierRemoval_Control.setRange(0, 50);
    outlierRemoval_Control.slider.setRange(0, 50);
    outlierRemoval_Control.slider.minWidth = 221;
    outlierRemoval_Control.setValue(data.outlierRemoval);
    return outlierRemoval_Control;
}

// Our dialog inherits all properties and methods from the core Dialog object.
PhotometricMosaicDialog.prototype = new Dialog;

// Photometric Mosaic main process
function main() {
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

    let checkedRefViewId = "";
    let checkedTgtViewId = "";
    let photometricMosaicDialog = new PhotometricMosaicDialog(data);
    for (; ; ) {
        data.viewFlag = 0;
        if (!photometricMosaicDialog.execute())
            break;
        console.show();
        console.abortEnabled = false; // Allowing abort would complicate cache strategy

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
        if (data.hasJoinAreaPreview){
            if (data.joinAreaPreviewRect.x1 > data.targetView.image.width || 
                    data.joinAreaPreviewRect.y1 > data.referenceView.image.height){
                (new MessageBox("ERROR: Join Region Preview extends beyond the edge of the image\n" +
                "Have you selected the wrong preview?", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
                continue;
            }
        }
        if (data.targetView.fullId === data.referenceView.fullId) {
            (new MessageBox("ERROR: Target and Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetGradientFlag && data.targetGradientSmoothness < data.overlapGradientSmoothness){
            (new MessageBox("'Gradient Correction (Target image)' Smoothness must be less than or equal to 'Gradient Correction (Overlap Region)' Smoothness", 
                    TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.cropTargetToJoinRegionFlag && data.mosaicRandomFlag){
            (new MessageBox("Valid mosaic combination modes for the 'Crop target' option are\nOverlay and Average", 
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
                    "Rough edges can cause a complete failure to match the two images, especially at the ends of the join.</p>" +
                    "<p>Use <b>" + TRIM_NAME() + "</b> to errode pixels from the edges of the registered mosaic tiles.</p>";
            return new MessageBox(msg, "Warning: Image may have soft or rough edges", 
                StdIcon_Warning, StdButton_Ignore, StdButton_Abort);
        };
        
        if (checkedTgtViewId !== data.targetView.fullId && 
                !(searchFitsHistory(data.targetView, TRIM_NAME()) || searchFitsHistory(data.targetView, "TrimImage"))){
            console.warningln("Warning: '" + data.targetView.fullId + "' has not been trimmed by the " + TRIM_NAME() + " script");
            if (getTrimMessageBox(data.targetView).execute() === StdButton_Abort){
                console.warningln("Aborted. Use " + TRIM_NAME() + " script to errode pixels from the registered image edges.");
                return;
            } else {
                checkedTgtViewId = data.targetView.fullId;
            }
        }
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

        // Run the script
        photometricMosaic(data, photometricMosaicDialog);
        data.saveParameters();  // Save script parameters to the history.
        console.hide();
    }
    
    return;
}
