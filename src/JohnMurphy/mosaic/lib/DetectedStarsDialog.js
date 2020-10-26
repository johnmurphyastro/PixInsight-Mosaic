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
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 * @returns {SampleGridDialog}
 */
function DetectedStarsDialog(title, refBitmap, tgtBitmap, detectedStars, data, photometricMosaicDialog)
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
    let nChannels = detectedStars.refColorStars.length;
    let colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
    let starPairs = getStarPairs(selectedChannel);
    
    let drawOrigPhotRects = false;
    
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
     * @param {Number} channel
     * @returns {StarPair[]}
     */
    function getStarPairs(channel){
        starPairs = [];
        if (channel < colorStarPairs.length){
            // return stars from channel 0, 1 or 2
            starPairs = colorStarPairs[channel];
        } else if (colorStarPairs.length === 3){
            // return stars in all channels
            starPairs = colorStarPairs[0].concat(colorStarPairs[1], colorStarPairs[2]);
        } else {
            starPairs = colorStarPairs[0];
        }
        return starPairs;
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
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000, 1.5);
            graphics.antialiasing = true;
            for (let i = 0; i < stars.length; ++i){
                let star = stars[i];
                let radius = Math.max(star.rect.width, star.rect.height)/2 + 3;
                let x = star.pos.x - bitmapOffset.x;
                let y = star.pos.y - bitmapOffset.y;
                graphics.strokeCircle(x, y, radius);
            }
        } catch (e){
            console.criticalln("drawDetectedStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    /**
     * Draw on top of the background bitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {PhotometricMosaicData} data Values from user interface
     */
    function drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1, data){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            // Draw inner star flux square and outer background sky flux square
            for (let i = 0; i < starPairs.length; ++i){
                let starPair = starPairs[i];
                let tgtStar = starPair.tgtStar;
                let refStar = starPair.refStar;
                let rect;
                if (selectedBitmap === REF){
                    if (drawOrigPhotRects){
                        rect = new Rect(refStar.unmodifiedRect);
                    } else {
                        rect = new Rect(refStar.rect);
                    }
                } else {
                    if (drawOrigPhotRects){
                        rect = new Rect(tgtStar.unmodifiedRect);
                    } else {
                        rect = new Rect(tgtStar.rect);
                    }
                }
                rect.moveBy(-bitmapOffset.x, -bitmapOffset.y);
                graphics.strokeRect(rect);
                let bg = rect.inflatedBy( data.apertureBgDelta );
                graphics.strokeRect(bg);
            }
        } catch(e) {
            console.criticalln("drawPhotometryStars error: " + e);
        } finally {
            graphics.end();
        }
    }
    
    let liveUpdate = false;
    
    /**
     * @param {HorizontalSizer} horizontalSizer
     */
    function customControls (horizontalSizer){
        let liveUpdate_control = new CheckBox(self);
        liveUpdate_control.text = "Live update";
        liveUpdate_control.toolTip = "<p>Live update. Deselect if controls are sluggish.</p>";
        liveUpdate_control.onCheck = function (checked){
            liveUpdate = checked;
            update_Button.enabled = !checked;
            if (checked){
                self.enabled = false;
                processEvents();
                updatePhotometry();
                self.enabled = true;
            }
        };
        liveUpdate_control.checked = liveUpdate;

        let update_Button = new PushButton(self);
        update_Button.text = "Update";
        update_Button.toolTip = "<p>Update display</p>";
        update_Button.onClick = function(){
            self.enabled = false;
            processEvents();
            updatePhotometry();
            self.enabled = true;
        };
        update_Button.enabled = !liveUpdate_control.checked;
        
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(liveUpdate_control);
        horizontalSizer.addSpacing(6);
        horizontalSizer.add(update_Button);
        horizontalSizer.addSpacing(20);
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, null, customControls, false);
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
        if (photometricCheckBox.checked){
            drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1, data);
        } else {
            drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
        }
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };

    // ========================================
    // User controls
    // ========================================
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display either reference background and stars, or " +
            "target background and stars.";
    refCheckBox.checked = true;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let photometricCheckBox = new CheckBox(this);
    photometricCheckBox.text = "Photometry";
    photometricCheckBox.toolTip = "<p>Indicates the stars that will be used for photometry.</p>" +
            "<p>These stars were found in both the target and reference images, " +
            "and were not rejected by the settings in the photometry section.</p>";
    photometricCheckBox.checked = true;
    photometricCheckBox.onClick = function (checked) {
        starPairs = getStarPairs(selectedChannel);
        previewControl.updateBitmap(bitmap);
        update();
    };
    
    let oldPhotometricCheckBox;
    if (EXTRA_CONTROLS()){
        oldPhotometricCheckBox = new CheckBox(this);
        oldPhotometricCheckBox.text = "Unmodified";
        oldPhotometricCheckBox.toolTip = "<p>Use photometry rectangles from StarDetector.</p>";
        oldPhotometricCheckBox.checked = drawOrigPhotRects;
        oldPhotometricCheckBox.onClick = function (checked) {
            drawOrigPhotRects = checked;
            starPairs = getStarPairs(selectedChannel);
            previewControl.updateBitmap(bitmap);
            update();
        };
    }
    
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "Display the stars detected within the red channel";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel = 0;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "Display the stars detected within the green channel";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel = 1;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "Display the stars detected within the blue channel";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel = 2;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the stars detected within all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel = 3;
        stars = getStars(selectedBitmap, selectedChannel);
        starPairs = getStarPairs(selectedChannel);
        update();
    };
    
    if (detectedStars.refColorStars.length === 1){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(photometricCheckBox);
    optionsSizer.add(refCheckBox);
    optionsSizer.addSpacing(10);
    optionsSizer.add(redRadioButton);
    optionsSizer.add(greenRadioButton);
    optionsSizer.add(blueRadioButton);
    optionsSizer.add(allRadioButton);
    optionsSizer.addStretch();
    if (EXTRA_CONTROLS())
        optionsSizer.add(oldPhotometricCheckBox);
    
    let strLen = this.font.width("Background delta:");
    let apertureLogGrowth_Control = createApertureLogGrowthControl(this, data, strLen);
    apertureLogGrowth_Control.onValueUpdated = function (value) {
        data.apertureLogGrowth = value;
        photometricMosaicDialog.apertureLogGrowth_Control.setValue(value);
        if (liveUpdate){
            updatePhotometry();
        }
    };
    let apertureAdd_Control = createApertureAddControl(this, data, strLen);
    apertureAdd_Control.onValueUpdated = function (value) {
        data.apertureAdd = value;
        photometricMosaicDialog.apertureAdd_Control.setValue(value);
        if (liveUpdate){
            updatePhotometry();
        }
    };
    let apertureGrowthLimit_Control = createApertureGrowthLimitControl(this, data, strLen);
    apertureGrowthLimit_Control.onValueUpdated = function (value) {
        data.apertureGrowthLimit = value;
        photometricMosaicDialog.apertureGrowthLimit_Control.setValue(value);
        if (liveUpdate){
            updatePhotometry();
        }
    };
    let apertureBkgDelta_Control = createApertureBkgDeltaControl(this, data, strLen);
    apertureBkgDelta_Control.onValueUpdated = function (value) {
        data.apertureBgDelta = value;
        photometricMosaicDialog.apertureBkgDelta_Control.setValue(value);
        if (liveUpdate){
            updatePhotometry();
        }
    };
    let aperture_Sizer1 = new HorizontalSizer(this);
    aperture_Sizer1.add(apertureLogGrowth_Control);
    aperture_Sizer1.addStretch();
    let aperture_Sizer2 = new HorizontalSizer(this);
    aperture_Sizer2.add(apertureAdd_Control);
    aperture_Sizer2.addStretch();
    let aperture_Sizer3 = new HorizontalSizer(this);
    aperture_Sizer3.add(apertureGrowthLimit_Control);
    aperture_Sizer3.addStretch();
    let aperture_Sizer4 = new HorizontalSizer(this);
    aperture_Sizer4.add(apertureBkgDelta_Control);
    aperture_Sizer4.addStretch();

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }
    
    function updatePhotometry(){
        detectedStars.showConsoleInfo = false;
        colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
        starPairs = getStarPairs(selectedChannel);
        update();
        detectedStars.showConsoleInfo = true;
    }

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(aperture_Sizer1);
    this.sizer.add(aperture_Sizer2);
    this.sizer.add(aperture_Sizer3);
    this.sizer.add(aperture_Sizer4);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the bitmap
    this.userResizable = true;
    let preferredWidth = previewControl.width + this.sizer.margin * 2 + this.logicalPixelsToPhysical(20);
    let preferredHeight = previewControl.height + previewControl.getButtonSizerHeight() +
            apertureAdd_Control.height * 4 + this.sizer.spacing * 6 + this.sizer.margin * 2 +
            refCheckBox.height + this.logicalPixelsToPhysical(20);
    this.resize(preferredWidth, preferredHeight);
    
    setTitle();
}

DetectedStarsDialog.prototype = new Dialog;
