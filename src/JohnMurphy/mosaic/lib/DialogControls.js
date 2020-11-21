// Version 1.0 (c) John Murphy 31st-Mar-2020
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

/**
 * @param {PhotometricMosaicDialog} dialog
 * @param {type} values
 * @param {Number} strLength
 * @returns {NumericControl}
 */
function createNumericControl(dialog, values, strLength){
    let control = new NumericControl(dialog);
    control.real = values.real;
    control.label.text = values.text;
    if (strLength > 0){
        control.label.minWidth = strLength;
    }
    control.toolTip = values.toolTip;
    control.setRange(values.range.min, values.range.max);
    control.slider.setRange(values.slider.range.min, values.slider.range.max);
    control.setPrecision(values.precision);
    let maxWidth = dialog.logicalPixelsToPhysical(values.maxWidth);
    control.maxWidth = Math.max(strLength + 50, maxWidth);
    return control;
}

/**
 * @param {PhotometricMosaicDialog} dialog
 * @param {type} values
 * @returns {NumericEdit}
 */
function createNumericEdit(dialog, values){
    let control = new NumericEdit(dialog);
    control.real = values.real;
    control.label.text = values.text;
    control.toolTip = values.toolTip;
    control.setRange(values.range.min, values.range.max);
    control.setPrecision(values.precision);
    return control;
}

/**
 * Add onMouseRelease, onKeyRelease and onLeave listeners to ensure that the 
 * supplied updateFunction is called when the NumericControl edit has finished.
 * @param {NumericControl} control
 * @param {Function({Number} controlValue)} updateFunction
 */
function addFinalUpdateListener(control, updateFunction){
    let updateNeeded = false;
    function finalUpdate(){
        updateNeeded = false;
        updateFunction(control.value);
    }
    control.slider.onMouseRelease = function (x, y, button, bState, modifiers) {
        finalUpdate();
    };
    control.onKeyRelease = function (keyCode, modifiers) {
        updateNeeded = true;
    };
    control.onLeave = function () {
        if (updateNeeded){
            finalUpdate();
        }
    };
}

function PhotometryControls(){
    let self = this;
    
    this.percentLimits = {
        real: true,
        text: "Limit stars %:",
        slider: {range: {min:0, max:500}},
        range: {min:0, max:100},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Specifies the percentage of detected stars used for photometry. " +
            "The faintest stars are rejected.</p>" +
            "<p>100% implies that all detected stars are used, up to a maximum of 1000.</p>" +
            "<p>90% implies that the faintest 10% of detected stars are rejected.</p>" +
            "<p>The default value of 100% usually works well.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createLimitPhotoStarsPercentControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.percentLimits, strLength);
        control.setValue(data.limitPhotoStarsPercent);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createLimitPhotoStarsPercentEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.percentLimits);
        control.setValue(data.limitPhotoStarsPercent);
        return control;
    };
    
    this.linearRange = {
        real: true,
        text: "Linear range:",
        slider: {range: {min:0, max:1000}},
        range: {min:0.001, max:1.0},
        precision: 3,
        maxWidth: 1000,
        toolTip: "<p>Restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value.</p>" +
            "<p>Use this to reject stars that are outside the " +
            "camera's linear response range.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createLinearRangeControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.linearRange, strLength);
        control.setValue(data.linearRange, self.linearRange);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createLinearRangeEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.linearRange);
        control.setValue(data.linearRange);
        return control;
    };

    this.outlierRemoval = {
        real: false,
        text: "Outlier removal:",
        slider: {range: {min:0, max:50}},
        range: {min:0, max:50},
        precision: 0,
        maxWidth: 400,
        toolTip: "<p>Number of outlier stars to remove.</p>" +
            "<p>Outliers can be due to variable stars, or measurement errors.</p>" +
            "<p>Removing a few outliers can improve accuracy, but don't over do it.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createOutlierRemovalControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.outlierRemoval, strLength);
        control.setValue(data.outlierRemoval);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createOutlierRemovalEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.outlierRemoval);
        control.setValue(data.outlierRemoval);
        return control;
    };
    
    this.growthRate = {
        real: true,
        text: "Growth rate:",
        slider: {range: {min:0, max:100}},
        range: {min:0, max:1},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Determines the aperture size for bright stars.</p>" +
            "<p>Adjust this control until the brightest stars entirely fit " +
            "within the inner photometry aperture. " +
            "Check both reference and target stars.</p>" +
            "<p>It is not necessary to include diffraction spikes.</p>" +
            "<p>If the photometry stars are too faint for this control to have " +
            "much effect, leave the control at its default of 0.2</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureGrowthRateControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.growthRate, strLength);
        control.setValue(data.apertureGrowthRate);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createApertureGrowthRateEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.growthRate);
        control.setValue(data.apertureGrowthRate);
        return control;
    };
    
    this.apertureAdd = {
        real: false,
        text: "Radius add:",
        slider: {range: {min:0, max:10}},
        range: {min:0, max:10},
        precision: 0,
        maxWidth: 250,
        toolTip: "<p>This value is added to the aperture radius for all stars.</p>" +
            "<p>Use this control to set the photometry aperture for <b>faint stars</b> " +
            "(use 'Growth rate' for brighter stars).</p>" +
            "<p>When correctly set, each faint reference and target star should " +
            "be fully contained within the inner photometry aperture.</p>" +
            "<p>Smaller apertures will introduce less noise, but it is vital that " +
            "the whole star is within the aperture.</p>" +
            "<p>The default value of 1 usually works well.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureAddControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.apertureAdd, strLength);
        control.setValue(data.apertureAdd);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createApertureAddEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.apertureAdd);
        control.setValue(data.apertureAdd);
        return control;
    };
    
    this.apertureBgDelta = {
        real: false,
        text: "Background delta:",
        slider: {range: {min:1, max:25}},
        range: {min:1, max:25},
        precision: 0,
        maxWidth: 250,
        toolTip: "<p>Background annulus thickness.</p>" +
            "<p>This determines the square ring around the star, used to " +
            "measure the background sky flux.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureBgDeltaControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.apertureBgDelta, strLength);
        control.setValue(data.apertureBgDelta);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createApertureBgDeltaEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.apertureBgDelta);
        control.setValue(data.apertureBgDelta);
        return control;
    };
    
    // Extra Control (debug)
    this.apertureGrowthLimit = {
        real: false,
        text: "Growth Limit:",
        slider: {range: {min:1, max:300}},
        range: {min:1, max:300},
        precision: 0,
        maxWidth: 800,
        toolTip: "<p>Maximum star aperture growth.</p>" +
            "<p>Limits the aperture radius growth to this number of pixels.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureGrowthLimitControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.apertureGrowthLimit, strLength);
        control.setValue(data.apertureGrowthLimit);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createApertureGrowthLimitEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.apertureGrowthLimit);
        control.setValue(data.apertureGrowthLimit);
        return control;
    };
}

//-------------------------------------------------------
// Sample Grid Controls
//-------------------------------------------------------
function SampleControls(){
    let self = this;
    
    this.joinSize = {
        real: false,
        text: "Size:",
        slider: {range: {min:1, max:1000}},
        range: {min:1, max:250},
        precision: 0,
        maxWidth: 800,
        toolTip: "<p>Specifies the thickness of the Join Region. " +
            "For a horizontal join, this is the height. For a vertical join, the width. " +
            "The ideal Join size depends on the Mosaic Combination mode:" +
            "<ul><li>Overlay: The join runs along the middle of the Join Region. " +
            "Reference pixels overlay target pixels on the reference side of the join, " +
            "Target pixels overlay reference pixels on the target side of the join.</li>" +
            "<li>Random: Join size should be large enough to blend the two images " +
            "together, but small enough not to include too many stars.</li>" +
            "<li>Average: Determines the area that will benefit from a higher " +
            "signal to noise ratio.</li></ul></p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createJoinSizeControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.joinSize, strLength);
        setJoinSizeRange(control, data, false);
        control.setValue(data.joinSize);
        control.toolTip = self.joinSize.toolTip + 
                "<p>Select 'Overlap rejection' to view the Join Region.</p>";
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createJoinSizeEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.joinSize);
        setJoinSizeRange(control, data, false);
        control.setValue(data.joinSize);
        control.toolTip = self.joinSize.toolTip + 
                "<p>View and edit the Join Region in the 'Sample generation' dialog.</p>";
        return control;
    };
    
    this.joinPosition = {
        real: false,
        text: "Position (+/-):",
        slider: {range: {min:-400, max:400}},
        range: {min:-10000, max:10000},
        precision: 0,
        maxWidth: 800,
        toolTip: "<p>Offsets the Join Region / Join Path " +
                "from the center of the overlap bounding box. " +
                "It moves left/right (vertical join) or " +
                "up/down (horizontal join).</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createJoinPositionControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.joinPosition, strLength);
        setJoinPositionRange(control, data, false);
        control.setValue(data.joinPosition);
        control.toolTip = self.joinPosition.toolTip + 
                "<p>Select 'Overlap rejection' to view the " +
                "Join Path / Join Region.</p>" +
                "<p>If the mosaic combination mode is 'Overlay', the Join Path is displayed. " +
                "For 'Random' or 'Average', the Join Region rectangle is drawn.</p>";
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createJoinPositionEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.joinPosition);
        setJoinPositionRange(control, data, false);
        control.setValue(data.joinPosition);
        control.toolTip = self.joinPosition.toolTip + 
                "<p>View and edit the Join / Join Region position in the " +
                "'Sample generation' dialog.</p>";
        return control;
    };
    
    this.percentLimits = {
        real: true,
        text: "Limit stars %:",
        slider: {range: {min:0, max:500}},
        range: {min:0, max:100},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars.</p>" +
            "<p>100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. This can affect how many of the " +
            "pixels illuminated by a star fall into a neighboring sample.</li></ul>" +
            "<p>However, it is more important to include enough samples than to reject faint stars.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createLimitSampleStarsPercentControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.percentLimits, strLength);
        control.setValue(data.limitSampleStarsPercent);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createLimitSampleStarsPercentEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.percentLimits);
        control.setValue(data.limitSampleStarsPercent);
        return control;
    };
    
    this.growthRate = {
        real: true,
        text: "Growth rate:",
        slider: {range: {min:0, max:200}},
        range: {min:0, max:2},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Determines the rejection radius for bright stars.</p>" +
            "<p>Use this control to set the rejection radius for bright, but unsaturated, stars " +
            "<p>Should normally be set to the same value as the photometry 'Growth rate'.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarGrowthRateControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.growthRate, strLength);
        control.setValue(data.sampleStarGrowthRate);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarGrowthRateEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.growthRate);
        control.setValue(data.sampleStarGrowthRate);
        return control;
    };
    
    this.growthLimit = {
        real: false,
        text: "Growth limit:",
        slider: {range: {min:1, max:400}},
        range: {min:1, max:400},
        precision: 0,
        maxWidth: 800,
        toolTip: "<p>Limits the rejection radius for saturated stars. " +
            "This setting is used when creating the surface spline that will be " +
            "used to correct the overlap region.</p>" +
            "<p>A 'Growth rate' suitable for unsaturated stars can produce large " +
            "rejection circles for the brightest stars. This control limits the " +
            "rejection radius growth to the specified number of pixels.</p>" +
            "<p>Select the 'Overlap rejection' checkbox (Sample Generation dialog) " +
            "to see the effects of this control.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarGrowthLimitControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.growthLimit, strLength);
        control.setValue(data.sampleStarGrowthLimit);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarGrowthLimitEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.growthLimit);
        control.setValue(data.sampleStarGrowthLimit);
        return control;
    };
    
    this.growthLimitTarget = {
        real: false,
        text: "Growth limit:",
        slider: {range: {min:1, max:400}},
        range: {min:1, max:400},
        precision: 0,
        maxWidth: 800,
        toolTip: "<p>Limits the rejection radius for saturated stars. " +
            "This setting is used when creating the surface spline that will be " +
            "used to correct the target image.</p>" +
            "<p>The target image gradient correction needs to ignore local " +
            "gradients - e.g. due to scattered light around bright stars. " +
            "The rejection radius around very bright stars needs to be large " +
            "enough to reject all samples that contain the star's scattered light.</p>" +
            "<p>Unselect the 'Overlap rejection' checkbox (Sample Generation dialog) " +
            "to see the effects of this control.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarGrowthLimitTargetControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.growthLimitTarget, strLength);
        control.setValue(data.sampleStarGrowthLimitTarget);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarGrowthLimitTargetEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.growthLimitTarget);
        control.setValue(data.sampleStarGrowthLimitTarget);
        return control;
    };
    
    this.growthRateTarget = {
        real: true,
        text: "Growth rate:",
        slider: {range: {min:0, max:200}},
        range: {min:0, max:2},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Determines the rejection radius for bright stars.</p>" +
            "<p>Use this control to set the rejection radius for bright, but unsaturated, stars</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarGrowthRateTargetControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.growthRateTarget, strLength);
        control.setValue(data.sampleStarGrowthRateTarget);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarGrowthRateTargetEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.growthRateTarget);
        control.setValue(data.sampleStarGrowthRateTarget);
        return control;
    };
    
    this.sampleSize = {
        real: false,
        text: "Sample size:",
        slider: {range: {min:2, max:150}},
        range: {min:2, max:150},
        precision: 0,
        maxWidth: 400,
        toolTip: "<p>Specifies the size of the sample squares.</p>" +
            "<p>The sample size should be at least 2x the size of the largest " +
            "star that's not rejected by 'Limit stars %'.</p>" +
            "<p>The sample's value is the median of its pixels. " +
            "They are used to create a surface spline that represents the relative gradient.</p>" +
            "<p>Samples are rejected if they contain one or more black pixels, " +
            "or if they are within a star's rejection radius.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} maxSampleSize Sample size is limited by join area thickness
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleSizeControl = function(dialog, data, maxSampleSize, strLength){
        let control = createNumericControl(dialog, self.sampleSize, strLength);
        if (maxSampleSize < self.sampleSize.range.max){
            control.setRange(self.sampleSize.range.min, maxSampleSize);
        }
        control.setValue(data.sampleSize);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} maxSampleSize Sample size is limited by join area thickness
     * @returns {NumericEdit}
     */
    this.createSampleSizeEdit = function(dialog, data, maxSampleSize){
        let control = createNumericEdit(dialog, self.sampleSize);
        if (maxSampleSize < self.sampleSize.range.max){
            control.setRange(self.sampleSize.range.min, maxSampleSize);
        }
        control.setValue(data.sampleSize);
        return control;
    };
}

//-------------------------------------------------------
// Gradient Controls
//-------------------------------------------------------
function GradientControls(){
    let self = this;
    
    this.overlapGradientSmoothness = {
        real: true,
        text: "Gradient smoothness:",
        slider: {range: {min:-400, max:300}},
        range: {min:-4, max:3},
        precision: 1,
        maxWidth: 800,
        toolTip: "<p>A surface spline is created to model the relative " +
        "gradient over the whole of the overlap region.</p>" +
        "<p>Smoothing needs to be applied to this surface spline to ensure it follows " +
        "the gradient but not the noise.</p>" +
        "<p>This control specifies the logarithm of the smoothness. " +
        "Larger values apply more smoothing.</p>"
    };
    
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createOverlapGradientSmoothnessControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.overlapGradientSmoothness, strLength);
        control.setValue(data.overlapGradientSmoothness);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createOverlapGradientSmoothnessEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.overlapGradientSmoothness);
        control.setValue(data.overlapGradientSmoothness);
        return control;
    };
    
    this.targetGradientSmoothness = {
        real: true,
        text: "Gradient smoothness:",
        slider: {range: {min:-200, max:500}},
        range: {min:-2, max:5},
        precision: 1,
        maxWidth: 800,
        toolTip: "<p>The target image gradient correction is determined from the gradient " +
        "along the target side edge of the Overlap's bounding box.</p>" +
        "<p>However, this gradient will contain local variations " +
        "(e.g. diffuse light around bright stars) that should not " +
        "be extrapolated across the target image.</p>" +
        "<p>Sufficient Smoothness should be applied to ensure that the " +
        "gradient correction only follows the gradient trend, rather than " +
        "these local variations.</p>" +
        "<p>If the gradient contains a sharp peak, use 'Growth limit (Target)' in " +
        "the 'Sample Generation' section to reject more samples around bright stars.</p>" +
        "<p>This control specifies the logarithm of the smoothness. " +
        "Larger values apply more smoothing.</p>"
    };
    
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createTargetGradientSmoothnessControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.targetGradientSmoothness, strLength);
        control.setValue(data.targetGradientSmoothness);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createTargetGradientSmoothnessEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.targetGradientSmoothness);
        control.setValue(data.targetGradientSmoothness);
        return control;
    };
}

/**
 * Sets the JoinPosition control min, max range. The range depends on data.joinSize
 * @param {Control} control Update this controls min, max range
 * @param {PhotometricMosaicData} data
 * @param {Boolean} updateData If true, update data.joinPosition to be within range
 */
function setJoinPositionRange(control, data, updateData){
    if (data.cache.overlap !== null){
        let joinRegion = new JoinRegion(data);
        let range = joinRegion.getJoinPositionRange();
        control.setRange(range.min, range.max);
        if (updateData){
            data.joinPosition = control.value;
        }
    }
};

/**
 * Sets the JoinSize control min, max range. This only depends on the overlap bounding box.
 * @param {Control} control Update this controls min, max range
 * @param {PhotometricMosaicData} data
 * @param {Boolean} updateData If true, update data.joinSize to be within range
 */
function setJoinSizeRange(control, data, updateData){
    if (data.cache.overlap !== null){
        let joinRegion = new JoinRegion(data);
        control.setRange(1, joinRegion.getMaxJoinSize());
        if (updateData){
            data.joinSize = control.value;
        }
    }
};
