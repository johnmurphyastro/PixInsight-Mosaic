/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes */

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
 * @param {PhotometricMosaicData} data
 * @param {Boolean} isColor
 * @param {Graph function({Number} zoomFactor, {Number} width, {Number} height, {Number} channel, {Boolean} info)} createZoomedGraph
 * Callback function used to create a zoomed graph
 * @param {PhotometricMosaicDialog} photometricMosaicDialog 
 * @returns {GradientGraphDialog}
 */
function GradientGraphDialog(title, data, isColor, createZoomedGraph, photometricMosaicDialog)
{
    this.__base__ = Dialog;
    this.__base__();
    let self = this;
    let zoom_ = 1;
    let selectedChannel_ = 3;
    let createZoomedGraph_ = createZoomedGraph;
    let width = this.logicalPixelsToPhysical(data.graphWidth);
    let height = this.logicalPixelsToPhysical(data.graphHeight);
    let graph_ = createZoomedGraph_(zoom_, width, height, selectedChannel_, false);
    
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
            console.criticalln("GradientGraphDialog bitmapControl.onPaint() error: " + e);
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
        update(wNew, hNew, false);
    };
    
    /**
     * @param {Number} zoom
     */
    function updateZoom (zoom) {
        if (zoom < 101 && zoom > -99){
            zoom_ = zoom;
            update(bitmapControl.width, bitmapControl.height, false);
            self.windowTitle = title + getZoomString();   // display zoom factor in title bar
        }
    }
    
    /**
     * @param {Number} width Graph bitmap width (
     * @param {Number} height Graph bitmap height
     * @param {Boolean} info If true, write to console
     */
    function update(width, height, info){
        try {
            graph_ = createZoomedGraph_(getZoomFactor(), width, height, selectedChannel_, info);
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
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     * @param {Number} value NumericControl's value
     */
    function finalUpdateFunction(value){
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height, true);
        self.enabled = true;
    }
    
    // Gradient controls
    let control;
    if (data.viewFlag === DISPLAY_TARGET_GRADIENT_GRAPH()){
        control = photometricMosaicDialog.targetGradientSmoothness_Control;
    } else {
        control = photometricMosaicDialog.overlapGradientSmoothness_Control;
    }
    let smoothnessControl = new NumericControl(this);
    smoothnessControl.real = true;
    smoothnessControl.setPrecision(1);
    smoothnessControl.label.text = "Smoothness:";
    smoothnessControl.toolTip = control.toolTip;
    smoothnessControl.onValueUpdated = function (value) {
        if (data.viewFlag === DISPLAY_TARGET_GRADIENT_GRAPH()){
            data.targetGradientSmoothness = value;
        } else {
            data.overlapGradientSmoothness = value;
        }
        control.setValue(value);
    };
    smoothnessControl.setRange(control.lowerBound, control.upperBound);
    smoothnessControl.slider.setRange(control.slider.minValue, control.slider.maxValue);
    smoothnessControl.slider.minWidth = 280;
    if (data.viewFlag === DISPLAY_TARGET_GRADIENT_GRAPH()){
        smoothnessControl.setValue(data.targetGradientSmoothness);
    } else {
        smoothnessControl.setValue(data.overlapGradientSmoothness);
    }
    addFinalUpdateListener(smoothnessControl, finalUpdateFunction);
    
    // ===========================
    // Color toggles
    // ===========================
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "<p>Display the red channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel_ = 0;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height, true);
        self.enabled = true;
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "<p>Display the green channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel_ = 1;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height, true);
        self.enabled = true;
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "<p>Display the blue channel gradient</p>" + 
            "<p>This is only used to unclutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel_ = 2;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height, true);
        self.enabled = true;
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the gradient for all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel_ = 3;
        self.enabled = false;
        processEvents();
        update(bitmapControl.width, bitmapControl.height, true);
        self.enabled = true;
    };
    
    if (!isColor){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }

    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(smoothnessControl);
    optionsSizer.addSpacing(20);
    optionsSizer.add(redRadioButton);
    optionsSizer.add(greenRadioButton);
    optionsSizer.add(blueRadioButton);
    optionsSizer.add(allRadioButton);
    optionsSizer.addStretch();
    
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
    zoomButton_Sizer.addStretch();
    zoomButton_Sizer.add(ok_Button);
    zoomButton_Sizer.addSpacing(10);
    
    //-------------
    // Global sizer
    //-------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(bitmapControl, 100);
    this.sizer.add(optionsSizer);
    this.sizer.add(zoomButton_Sizer);
    
    this.userResizable = true;
    let preferredWidth = width + this.sizer.margin * 2;
    let preferredHeight = height + this.sizer.margin * 2 + this.sizer.spacing * 2 + 
           zoomIn_Button.height * 2 + 4;
    this.resize(preferredWidth, preferredHeight);
    
    this.setScaledMinSize(300, 300);
    this.windowTitle = title + " 1:1";
}

GradientGraphDialog.prototype = new Dialog;