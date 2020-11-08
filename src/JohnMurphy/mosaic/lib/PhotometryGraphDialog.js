/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes, PhotometryControls */

// Version 1.0 (c) John Murphy 12th-Aug-2020
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
 * Create a dialog that displays a graph.
 * The Graph object returned from the supplied createZoomedGraph(Number zoomFactor) 
 * function must include the methods:
 * Bitmap Graph.getGraphBitmap()
 * String Graph.screenToWorld(Number x, Number y)
 * The GraphDialog is initialised with the Graph returned from createZoomedGraph, 
 * with a zoom factor of 1
 * @param {String} title Window title
 * @param {Number} width Dialog window width
 * @param {Number} height Dialog window height
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @param {Graph function({Number} zoomFactor, {Number} width, {Number} height)} createZoomedGraph
 * Callback function used
 * to create a zoomed graph
 * @returns {PhotometryGraphDialog}
 */
function PhotometryGraphDialog(title, width, height, data, photometricMosaicDialog, createZoomedGraph)
{
    this.__base__ = Dialog;
    this.__base__();
    let self = this;
    let zoom_ = 1;
    let selectedChannel_ = 3;
    let useSmallPoints = false;
    let createZoomedGraph_ = createZoomedGraph;
    let graph_ = createZoomedGraph_(zoom_, width, height, selectedChannel, useSmallPoints);
    
    /**
     * Converts bitmap (x,y) into graph coordinates.
     * @param {Number} x Bitmap x coordinate
     * @param {Number} y Bitmap y coordinate
     * @returns {String} Output string in format "( x, y )"
     */
    function displayXY(x, y){
        self.windowTitle = title + getZoomString() + "  " + graph_.screenToWorld(x, y);
    };
    
    // Draw bitmap into this component
    let bitmapControl = new Control(this);
    
    bitmapControl.onPaint = function (){
        let g;
        try {
            g = new Graphics(this);
            g.clipRect = new Rect(0, 0, this.width, this.height);
            g.drawBitmap(0, 0, graph_.getGraphBitmap());
        } catch (e) {
            console.criticalln("PhotometryGraphDialog bitmapControl.onPaint error: " + e);
        } finally {
            g.end();
        }
    };
    
    bitmapControl.onMousePress = function ( x, y, button, buttonState, modifiers ){
        // Display graph coordinates in title bar
        displayXY(x, y);
    };
    
    bitmapControl.onMouseMove = function ( x, y, buttonState, modifiers ){
        // When dragging mouse, display graph coordinates in title bar
        displayXY(x, y);
        // TODO create pan mode using space bar (modifiers = 8)
    };
    
    bitmapControl.onMouseWheel = function ( x, y, delta, buttonState, modifiers ){
        if (delta < 0){
            updateZoom( zoom_ + 1);
        } else {
            updateZoom( zoom_ - 1);
        }
    };
    
    bitmapControl.onResize = function (wNew, hNew, wOld, hOld) {
        update(wNew, hNew);
    };
    
    /**
     * @param {Number} zoom
     */
    function updateZoom (zoom) {
        if (zoom < 101 && zoom > -99){
            zoom_ = zoom;
            update(bitmapControl.width, bitmapControl.height);
            self.windowTitle = title + getZoomString();   // display zoom factor in title bar
        }
    }
    
    /**
     * @param {Number} width Graph bitmap width (
     * @param {Number} height Graph bitmap height
     */
    function update(width, height){
        try {
            graph_ = createZoomedGraph_(getZoomFactor(), width, height, selectedChannel, useSmallPoints);
            bitmapControl.repaint();    // display the zoomed graph bitmap
        } catch (e) {
            console.criticalln("Graph update error: " + e);
        }
    }
    
    /**
     * If zoom_ is positive, return zoom_ (1 to 100)
     * If zoom_ is zero or negative, then:
     * 0 -> 1/2
     * -1 -> 1/3
     * -2 -> 1/4
     * -98 -> 1/100
     * @returns {Number} Zoom factor
     */
    function getZoomFactor(){
        return zoom_ > 0 ? zoom_ : 1 / (2 - zoom_);
    }
    
    /**
     * @returns {String} Zoom string (e.g. " 1:2")
     */
    function getZoomString(){
        let zoomFactor = getZoomFactor();
        if (zoomFactor < 1){
            return " 1:" + Math.round(1/zoomFactor);
        } else {
            return " " + zoomFactor + ":1";
        }
    }
    
    bitmapControl.toolTip = 
            "Mouse wheel: Zoom" +
            "\nLeft click: Display (x,y) in title bar";
    
    bitmapControl.setMinHeight(142);
    
    // ========================================
    // User controls
    // ========================================
    let controlsHeight = 0;
    let minHeight = bitmapControl.minHeight;
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            if (bar.isExpanded()){
                bitmapControl.setMinHeight(bitmapControl.height + bar.section.height + 2);
            } else {
                bitmapControl.setMinHeight(bitmapControl.height - bar.section.height - 2);
            }
            this.adjustToContents();
        }  else {
            bitmapControl.setMinHeight(minHeight);
            let maxDialogHeight = self.logicalPixelsToPhysical(1150);
            if (self.height > maxDialogHeight)
                self.resize(self.width, maxDialogHeight);
        }
    };
    
    // ===========================
    // Zoom controls and OK button
    // ===========================
    let zoomIn_Button = new ToolButton(this);
    zoomIn_Button.icon = this.scaledResource(":/icons/zoom-in.png");
    zoomIn_Button.setScaledFixedSize(24, 24);
    zoomIn_Button.toolTip = "Zoom In";
    zoomIn_Button.onMousePress = function (){
        updateZoom( zoom_ + 1);
    };

    let zoomOut_Button = new ToolButton(this);
    zoomOut_Button.icon = this.scaledResource(":/icons/zoom-out.png");
    zoomOut_Button.setScaledFixedSize(24, 24);
    zoomOut_Button.toolTip = "Zoom Out";
    zoomOut_Button.onMousePress = function (){
        updateZoom( zoom_ - 1);
    };

    let zoom11_Button = new ToolButton(this);
    zoom11_Button.icon = this.scaledResource(":/icons/zoom-1-1.png");
    zoom11_Button.setScaledFixedSize(24, 24);
    zoom11_Button.toolTip = "Zoom 1:1";
    zoom11_Button.onMousePress = function (){
        updateZoom( 1 );
    };
    
    let liveUpdate_control = new CheckBox(this);
    liveUpdate_control.text = "Live update";
    liveUpdate_control.toolTip = "<p>Live update. Deselect if controls are sluggish.</p>";
    liveUpdate_control.onCheck = function (checked){
        update_Button.enabled = !checked;
        if (checked){
            self.enabled = false;
            processEvents();
            update(bitmapControl.width, bitmapControl.height);
            self.enabled = true;
        }
    };
    liveUpdate_control.checked = false;
    
    let update_Button = new PushButton(this);
    update_Button.text = "Update";
    update_Button.toolTip = "<p>Update display</p>";
    update_Button.onClick = function(){
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    update_Button.enabled = !liveUpdate_control.checked;
    
    let ok_Button = new PushButton(this);
    ok_Button.text = "OK";
    ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
    ok_Button.onClick = function(){
        self.ok();
    };

    let zoomButton_Sizer = new HorizontalSizer(this);
    zoomButton_Sizer.margin = 0;
    zoomButton_Sizer.spacing = 4;
    zoomButton_Sizer.add(zoomIn_Button);
    zoomButton_Sizer.add(zoomOut_Button);
    zoomButton_Sizer.add(zoom11_Button);
    zoomButton_Sizer.addSpacing(17);
    zoomButton_Sizer.add(liveUpdate_control);
    zoomButton_Sizer.addSpacing(6);
    zoomButton_Sizer.add(update_Button);
    zoomButton_Sizer.addSpacing(17);
    zoomButton_Sizer.addStretch();
    zoomButton_Sizer.add(ok_Button);
    zoomButton_Sizer.addSpacing(10);
    controlsHeight += update_Button.height;
    
    // ===========================
    // Color toggles
    // ===========================
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "<p>Display the red channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The settings will be applied to all color channels.</p>";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel_ = 0;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "<p>Display the green channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The settings will be applied to all color channels.</p>";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel_ = 1;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "<p>Display the blue channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The settings will be applied to all color channels.</p>";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel_ = 2;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel_ = 3;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    
    if (!data.targetView.image.isColor){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }
    
    let smallPoints = new CheckBox(this);
    smallPoints.text = "Small points";
    smallPoints.toolTip = "Use a dot instead of '+' to represent data points.";
    smallPoints.checked = useSmallPoints;
    smallPoints.onClick = function (checked) {
        useSmallPoints = checked;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height);
        self.enabled = true;
    };
    
    let color_Sizer = new HorizontalSizer(this);
    color_Sizer.margin = 0;
    color_Sizer.spacing = 10;
    color_Sizer.addSpacing(4);
    color_Sizer.add(redRadioButton);
    color_Sizer.add(greenRadioButton);
    color_Sizer.add(blueRadioButton);
    color_Sizer.add(allRadioButton);
    color_Sizer.addSpacing(10);
    color_Sizer.add(smallPoints);
    color_Sizer.addStretch();
    
    controlsHeight += redRadioButton.height;
    
    // ===================================================
    // SectionBar: Star filters
    // ===================================================
    const BACKGROUND_DELTA_STRLEN = this.font.width("Background delta:");
    let photometryControls = new PhotometryControls();
    
    let limitPhotoStarsPercent_Control = photometryControls.createLimitPhotoStarsPercentControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    limitPhotoStarsPercent_Control.onValueUpdated = function (value) {
        data.limitPhotoStarsPercent = value;
        photometricMosaicDialog.limitPhotoStarsPercent_Control.setValue(value);
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
    controlsHeight += limitPhotoStarsPercent_Control.height;
    
    let linearRange_Control = photometryControls.createLinearRangeControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    linearRange_Control.onValueUpdated = function (value) {
        data.linearRange = value;
        photometricMosaicDialog.linearRange_Control.setValue(value);
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
    controlsHeight += linearRange_Control.height;
    
    let outlierRemoval_Control = photometryControls.createOutlierRemovalControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemoval = value;
        photometricMosaicDialog.outlierRemoval_Control.setValue(value);
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
    controlsHeight += outlierRemoval_Control.height;
    
    let filterSection = new Control(this);
    filterSection.sizer = new VerticalSizer;
    filterSection.sizer.spacing = 2;
    filterSection.sizer.add(limitPhotoStarsPercent_Control);
    filterSection.sizer.add(linearRange_Control);
    filterSection.sizer.add(outlierRemoval_Control);
    filterSection.sizer.addSpacing(5);
    let filterBar = new SectionBar(this, "Filter Photometry Stars");
    filterBar.setSection(filterSection);
    filterBar.onToggleSection = this.onToggleSection;
    filterBar.toolTip = "Specifies which stars are used for photometry";
    controlsHeight += filterBar.height + filterSection.sizer.spacing * 2 + 5;
    
    // ===================================================
    // SectionBar: Star aperture size
    // ===================================================
    let apertureGrowthRate_Control = photometryControls.createApertureGrowthRateControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    apertureGrowthRate_Control.onValueUpdated = function (value) {
        data.apertureGrowthRate = value;
        photometricMosaicDialog.apertureGrowthRate_Control.setValue(value);
        photometricMosaicDialog.setSampleStarGrowthRateAutoValue();
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
//    controlsHeight += apertureGrowthRate_Control.height;
    let apertureAdd_Control = photometryControls.createApertureAddControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    apertureAdd_Control.onValueUpdated = function (value) {
        data.apertureAdd = value;
        photometricMosaicDialog.apertureAdd_Control.setValue(value);
        photometricMosaicDialog.setSampleStarRadiusAddAutoValue();
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
//    controlsHeight += apertureAdd_Control.height;
    let apertureBgDelta_Control = photometryControls.createApertureBgDeltaControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    apertureBgDelta_Control.onValueUpdated = function (value) {
        data.apertureBgDelta = value;
        photometricMosaicDialog.apertureBgDelta_Control.setValue(value);
        if (liveUpdate_control.checked){
            update(bitmapControl.width, bitmapControl.height);
        }
    };
//    controlsHeight += apertureBgDelta_Control.height;
    
    let apertureSection = new Control(this);
    apertureSection.sizer = new VerticalSizer;
    apertureSection.sizer.spacing = 2;
    apertureSection.sizer.add(apertureGrowthRate_Control);
    if (EXTRA_CONTROLS()){
        let apertureGrowthLimit_Control = photometryControls.createApertureGrowthLimitControl(
                this, data, BACKGROUND_DELTA_STRLEN);
        apertureGrowthLimit_Control.onValueUpdated = function (value) {
            data.apertureGrowthLimit = value;
            photometricMosaicDialog.apertureGrowthLimit_Control.setValue(value);
            if (liveUpdate_control.checked){
                update(bitmapControl.width, bitmapControl.height);
            }
        };
//      controlsHeight += apertureGrowthLimit_Control.height;
        apertureSection.sizer.add(apertureGrowthLimit_Control);
    }
    apertureSection.sizer.add(apertureAdd_Control);
    apertureSection.sizer.add(apertureBgDelta_Control);
    let apertureBar = new SectionBar(this, "Star Aperture Size");
    apertureBar.setSection(apertureSection);
    apertureBar.onToggleSection = this.onToggleSection;
    apertureBar.toolTip = "Specifies photometry star aperture settings";
    controlsHeight += apertureBar.height;
    //controlsHeight += apertureBar.height + apertureSection.sizer.spacing * 3;
    
    //-------------
    // Global sizer
    //-------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(bitmapControl, 100);
    this.sizer.add(color_Sizer);
    this.sizer.add(apertureBar);
    this.sizer.add(apertureSection);
    this.sizer.add(filterBar);
    this.sizer.add(filterSection);
    this.sizer.add(zoomButton_Sizer);
    apertureSection.hide();
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 5;
    //controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 6;
    
    this.userResizable = true;
    let preferredWidth = width + this.sizer.margin * 2;
    let preferredHeight = height + controlsHeight;
    this.resize(preferredWidth, preferredHeight);
    this.setScaledMinSize(300, 300);
    this.windowTitle = title + " 1:1";
}

PhotometryGraphDialog.prototype = new Dialog;