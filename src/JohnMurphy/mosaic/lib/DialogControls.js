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
    control.maxWidth = values.maxWidth;
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

function PhotometryControls(){
    let self = this;
    
    this.percentLimits = {
        real: true,
        text: "Limit stars %:",
        slider: {range: {min:0, max:200}},
        range: {min:0, max:100},
        precision: 2,
        maxWidth: 500,
        toolTip: "<p>Specifies the percentage of detected stars used for photometry. " +
            "The faintest stars are rejected.</p>" +
            "<p>100% implies that all detected stars are used, up to a maximum of 1000.</p>" +
            "<p>90% implies that the faintest 10% of detected stars are rejected.</p>" +
            "<p>0% implies no stars will be used. The scale will default to one.</p>"
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
            "<p>Outliers can be due to variable stars, or measurement issues.</p>" +
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
        slider: {range: {min:0, max:300}},
        range: {min:0, max:3},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Aperture radius growth rate.</p>" +
            "<p>The aperture radius increase depends on the star's peak value " +
            "and this grow rate. Zero produces no growth.</p>"
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
        toolTip: "<p>Minimum star aperture growth.</p>" +
            "<p>This value gets added to the aperture radius for all stars.</p>"
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
        toolTip: "<p>Background annulus thickness.</p>"
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
        slider: {range: {min:3, max:300}},
        range: {min:3, max:300},
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
    
    this.percentLimits = {
        real: false,
        text: "Limit stars %:",
        slider: {range: {min:0, max:100}},
        range: {min:0, max:100},
        precision: 0,
        maxWidth: 300,
        toolTip: "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
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
            "include most of the samples than to reject faint stars.</p>"
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
        slider: {range: {min:0, max:300}},
        range: {min:0, max:3},
        precision: 2,
        maxWidth: 800,
        toolTip: "<p>Increase to reject more samples around saturated stars.</p>" +
            "<p>Read the Help sections on 'Join Region' to learn when these " +
            "samples should be rejected.</p>"
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
        text: "Growth Limit (Overlap):",
        slider: {range: {min:3, max:300}},
        range: {min:3, max:300},
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
        text: "Growth Limit (Target):",
        slider: {range: {min:3, max:300}},
        range: {min:3, max:300},
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
    
    this.radiusAdd = {
        real: false,
        text: "Radius add:",
        slider: {range: {min:0, max:10}},
        range: {min:0, max:10},
        precision: 0,
        maxWidth: 250,
        toolTip: "<p>Minimum star aperture growth.</p>" +
            "<p>This value gets added to the aperture radius for all stars.</p>"
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarAddControl = function(dialog, data, strLength){
        let control = createNumericControl(dialog, self.radiusAdd, strLength);
        control.setValue(data.sampleStarRadiusAdd);
        return control;
    };
    /**
     * @param {PhotometricMosaicDialog} dialog
     * @param {PhotometricMosaicData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarAddEdit = function(dialog, data){
        let control = createNumericEdit(dialog, self.radiusAdd);
        control.setValue(data.sampleStarRadiusAdd);
        return control;
    };
    
    this.sampleSize = {
        real: false,
        text: "Sample size:",
        slider: {range: {min:2, max:150}},
        range: {min:2, max:150},
        precision: 0,
        maxWidth: 300,
        toolTip: "<p>Specifies the size of the sample squares.</p>" +
            "<p>The sample size should be greater than 2x the size of the largest " +
            "star that's not rejected by 'Limit stars %'.</p>"
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
