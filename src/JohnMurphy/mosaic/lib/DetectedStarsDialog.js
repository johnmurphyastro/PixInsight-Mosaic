/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow, StdCursor_Checkmark */

// Version 1.0 (c) John Murphy 30th-July-2020
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
 * Display the detected stars in a Dialog that contains a scrolled window.
 * The user can choose to display stars from the reference image or the target image.
 * @param {String} title Window title
 * @param {Bitmap} refBitmap Background image of the reference overlap area at 1:1 scale
 * @param {Bitmap} tgtBitmap Background image of the target overlap area at 1:1 scale
 * @param {StarsDetected} detectedStars Contains all the detected stars
 * @param {PhotometricMosaicData} data Values from user interface
 * @returns {SampleGridDialog}
 */
function DetectedStarsDialog(title, refBitmap, tgtBitmap, detectedStars, data)
{
    this.__base__ = Dialog;
    this.__base__();
    
    const REF = 10;
    const TGT = 20;
    let self = this;
    
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let selectedBitmap = REF;
    let selectedChannel = 3;    // 0=R, 1=G, 2=B, 3 = all
    let bitmapOffset = getBitmapOffset(data);
    let bitmap = getBitmap(selectedBitmap);
    let stars = getStars(selectedBitmap, selectedChannel);
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? refBitmap : tgtBitmap;
    }
    
    /**
     * Display the stars detected in the reference (refOrTgt = REF) or target image.
     * The displayed stars can be limited to a single color channel.
     * @param {NUMBER} refOrTgt Set to REF or TGT
     * @param {Number} channel Only display stars from this channel. If channel = 3,
     * show all stars in the image (reference image or target image)
     * @returns {Star[]}
     */
    function getStars(refOrTgt, channel){
        let colorStars = refOrTgt === REF ? detectedStars.refColorStars : detectedStars.tgtColorStars;
        stars = [];
        if (channel < colorStars.length){
            stars = colorStars[channel];
        } else if (colorStars.length === 3){
            stars = colorStars[0].concat(colorStars[1], colorStars[2]);
        } else {
            stars = colorStars[0];
        }
        return stars;
    }
    
    /**
     * The offset between the full mosaic image and the bounding box of the overlap area.
     * Note that bitmap is of the overlap area.
     * @param {PhotometricMosaicData} data
     * @returns {Point} bitmap offset
     */
    function getBitmapOffset(data){
        let overlapBox = data.cache.overlap.overlapBox;
        return new Point(overlapBox.x0, overlapBox.y0);
    }
    
    /**
     * Set dialog title, including the current zoom and cursor coordinates
     */
    function setTitle(){
        self.windowTitle = title + " " + zoomText + " " + coordText;
    };
    
    /**
     * Set coordText, the cursor coordinate text. The coordText
     * is relative to the full mosaic image's top left corner.
     * @param {Point} point cursor coordinates relative to the (1:1) bitmap
     */
    function setCoordText(point){
        if (point === null){
            coordText = "(---,---)";
        } else {
            let x = bitmapOffset.x + point.x;
            let y = bitmapOffset.y + point.y;
            coordText = format("(%8.2f,%8.2f )", x, y);
        }
    }
    
    /**
     * Draw on top of the background bitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     */
    function drawDetectedStars(viewport, translateX, translateY, scale){
        let graphics = new VectorGraphics(viewport);
        graphics.translateTransformation(translateX, translateY);
        graphics.scaleTransformation(scale, scale);
        graphics.pen = new Pen(0xffff0000);
        graphics.antialiasing = true;
        for (let i = 0; i < stars.length; ++i){
            let star = stars[i];
            let radius = Math.sqrt(star.size)/2 + 4;
            let x = star.pos.x - bitmapOffset.x;
            let y = star.pos.y - bitmapOffset.y;
            graphics.strokeCircle(x, y, radius);
        }
        graphics.end();
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null);
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        setCoordText(point);
        setTitle();
    };
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        drawDetectedStars(viewport, translateX, translateY, scale);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };

    // ========================================
    // User controls
    // ========================================
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "If selected show reference stars. Otherwise show target stars.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        stars = getStars(selectedBitmap, selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "Display the detected stars within the red channel";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel = 0;
        stars = getStars(selectedBitmap, selectedChannel);
        update();
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "Display the detected stars within the green channel";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel = 1;
        stars = getStars(selectedBitmap, selectedChannel);
        update();
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "Display the detected stars within the blue channel";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel = 2;
        stars = getStars(selectedBitmap, selectedChannel);
        update();
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the detected stars from all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel = 3;
        stars = getStars(selectedBitmap, selectedChannel);
        update();
    };
    
    if (detectedStars.refColorStars.length === 1){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }
    
    let optionsSizer = new HorizontalSizer();
    optionsSizer.margin = 4;
    optionsSizer.spacing = 10;
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(redRadioButton);
    optionsSizer.add(greenRadioButton);
    optionsSizer.add(blueRadioButton);
    optionsSizer.add(allRadioButton);
    optionsSizer.addStretch();

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 4;
    this.sizer.spacing = 4;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + 50;
    let preferredHeight = previewControl.height + 50 + 4 * 3 + refCheckBox.height;
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

DetectedStarsDialog.prototype = new Dialog;
