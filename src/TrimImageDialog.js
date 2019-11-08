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
#feature-id Utilities > trimImage

#feature-info Linear fits target and reference images over the overlaping area.<br/>\
Copyright &copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/UndoFlag.jsh>

#define VERSION "1.0"
#define TITLE "Trim Image"
#define DEFAULT_TRIM 3;

/**
 * Returns the elapsed time since startTime.
 * If the elapsed time is less than a second, it is returned as milliseconds, with a 'ms' postfix.
 * Otherwise it is returned as seconds, with a 's' postfix.
 *
 * @param {number} startTime
 * @return {string} Time elapsed since startTime
 */
function getElapsedTime(startTime){
  let totalTime = new Date().getTime() - startTime;
  if(totalTime < 1000){
    totalTime += " ms";
  } else {
    totalTime /= 1000;
    totalTime += " s";
  }
  return totalTime;
}

/**
 * @param {Image} image
 * @param {number} x x-coordinate
 * @param {number} y y-coordinate
 * @return true if the specified pixel has a non zero value in one or more channels
 */
function isNotBlack(image, x, y){
  if (image.isColor){
    return (image.sample(x, y, 0) !== 0) || (image.sample(x, y, 1) !== 0) || (image.sample(x, y, 2) !== 0);
  }
  return image.sample(x, y, 0) !== 0;
}

/**
 * Set the specified pixel to zero
 * @param {Image} image
 * @param {number} x x-coordinate
 * @param {number} y y-coordinate
 */
function setBlack(image, x, y){
  image.setSample(0, x, y, 0);
  if (image.isColor){
    image.setSample(0, x, y, 1);
    image.setSample(0, x, y, 2);
  }
}

/** Private function
 * @param {Image} image
 * @param {number} row Y coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the row has image content
 */
function trimRowLeft(image, row, nPixels){
  let w = image.width;
  for (let x = 0; x < w; x++){
    if (isNotBlack(image, x, row)){
      for (let trim = 0; trim < nPixels; trim++){
        let xCoord = x + trim;
        if (xCoord < w){
          setBlack(image, xCoord, row);
        } else {
          break;
        }
      }
      return true;
    }
  }
  return false; // empty row
}

/** Private function
 * @param {Image} image
 * @param {number} row Y coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the row has image content
 */
function trimRowRight(image, row, nPixels){
  let w = image.width;
  for (let x = w-1; x > -1; x--){
    if (isNotBlack(image, x, row)){
      for (let trim = 0; trim < nPixels; trim++){
        let xCoord = x - trim;
        if (xCoord > -1){
          setBlack(image, xCoord, row);
        } else {
          break;
        }
      }
      return true;
    }
  }
  return false; // empty row
}

/** Private function
 * @param {Image} image
 * @param {number} col X coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the col has image content
 */
function trimColumnTop(image, col, nPixels){
  let h = image.height;
  for (let y = 0; y < h; y++){
      if (isNotBlack(image, col, y)){
      for (let trim = 0; trim < nPixels; trim++){
        let yCoord = y + trim;
        if (yCoord < h){
          setBlack(image, col, yCoord);
        } else {
          break;
        }
      }
      return true;
    }
  }
  return false; // empty col
}

/** Private function
 * @param {Image} image
 * @param {number} col X coordinate
 * @param {number} nPixels Number of pixels to trim
 * @return {boolean} true if the column has image content
 */
function trimColumnBottom(image, col, nPixels){
  let h = image.height;
  for (let y = h-1; y > -1; y--){
    if (isNotBlack(image, col, y)){
      for (let trim = 0; trim < nPixels; trim++){
        let yCoord = y - trim;
        if (yCoord > -1){
          setBlack(image, col, yCoord);
        } else {
          break;
        }
      }
      return true;
    }
  }
  return false; // empty col
}

/**
 * @param {Image} image
 * @param {number} nLeft Number of pixels to remove from left of non zero part of image
 * @param {number} nRight Number of pixels to remove from right of non zero part of image
 */
function trimRows(image, nLeft, nRight){
  if (nLeft == 0 && nRight == 0){
    return; // nothing to trim
  }
  let h = image.height;
  for (let row = 0; row < h; row++){
    let rowHasContent = true;
    if (nLeft > 0){
      rowHasContent = trimRowLeft(image, row, nLeft);
    }
    if (rowHasContent && nRight > 0){
      trimRowRight(image, row, nRight);
    }
  }
}

/**
 * @param {Image} image
 * @param {number} nTop Number of pixels to remove from top of non zero part of image
 * @param {number} nBottom Number of pixels to remove from bottom of non zero part of image
 */
function trimColumns(image, nTop, nBottom){
  if (nTop == 0 && nBottom == 0){
    return; // nothing to trim
  }
  let w = image.width;
  for (let column = 0; column < w; column++){
    let colHasContent = true;
    if (nTop > 0){
      colHasContent = trimColumnTop(image, column, nTop);
    }
    if (colHasContent && nBottom > 0){
      trimColumnBottom(image, column, nBottom);
    }
  }
}

/**
* Controller. Processing starts here!
* @param {trimImageData} data Values from user interface
*/
function trimImage(data)
{
  let startTime = new Date().getTime();

  // Grab the view data from the form
  let targetView    = data.targetView;

  console.writeln("Target: ", targetView.fullId,
    ", Top: ", data.top,
    ", Bottom: ", data.bottom,
    ", Left: ", data.left,
    ", Right: ", data.right);

  let image = targetView.image;

  // Begin process to let PixInsight know the script is about to modify image data.
  // It will then allow us write access
  targetView.beginProcess();
  trimRows(image, data.left, data.right);
  trimColumns(image, data.top, data.bottom);
  // Send our parameters to PixInsight core so that it can be added to the history event
  data.saveParameters();
  targetView.endProcess();

  console.writeln("\n" + TITLE + ": Total time ", getElapsedTime(startTime));
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function TrimImageData() {

  // Used to poplulate the contents of a saved process icon
  this.saveParameters = function (){
    if (this.targetView.isMainView){
      Parameters.set( "targetView", this.targetView.fullId );
    }
    Parameters.set( "left", this.left );
    Parameters.set( "right", this.right );
    Parameters.set( "top", this.top );
    Parameters.set( "bottom", this.bottom );
  };

  // Reload our script's data from a process icon
  this.loadParameters = function (){
    if ( Parameters.has( "left" ) )
    this.left = Parameters.getInteger( "left" );
    if ( Parameters.has( "right" ) )
    this.right = Parameters.getReal( "right" );
    if ( Parameters.has( "top" ) )
    this.top = Parameters.getInteger( "top" );
    if ( Parameters.has( "bottom" ) )
    this.bottom = Parameters.getInteger( "bottom" );
    if ( Parameters.has( "targetView" ) ){
      let viewId = Parameters.getString( "targetView" );
      this.targetView = View.viewById( viewId )
    }
  };

  // Initialise the scripts data
  this.setParameters = function (){
    this.left   = DEFAULT_TRIM;
    this.right  = DEFAULT_TRIM;
    this.top    = DEFAULT_TRIM;
    this.bottom = DEFAULT_TRIM;
  };

  // Used when the user presses the reset button
  this.resetParameters = function (linearFitDialog){
    this.setParameters();
    linearFitDialog.left_Control.setValue(this.left);
    linearFitDialog.right_Control.setValue(this.right);
    linearFitDialog.top_Control.setValue(this.top);
    linearFitDialog.bottom_Control.setValue(this.bottom);
  };

  // Initialise the script's data
  let activeWindow = ImageWindow.activeWindow;
  if(!activeWindow.isNull) {
    this.targetView    = activeWindow.currentView;
  }
  this.setParameters();
}

// The main dialog function
function trimImageDialog(data) {
  this.__base__ = Dialog;
  this.__base__();

  //-------------------------------------------------------
  // Set some basic widths from dialog text
  //-------------------------------------------------------
  let labelWidth1 = this.font.width("Bottom:_");

  //-------------------------------------------------------
  // Create the Program Discription at the top
  //-------------------------------------------------------
  this.helpLabel = new Label(this);
  this.helpLabel.frameStyle   = FrameStyle_Box;
  this.helpLabel.margin       = 4;
  this.helpLabel.wordWrapping = true;
  this.helpLabel.useRichText  = true;
  this.helpLabel.text         = "<b>" + TITLE + " v" + VERSION + "</b> &mdash; Trim the edge of the none zero area.";

  //-------------------------------------------------------
  // Create the target image field
  //-------------------------------------------------------
  this.targetImage_Label = new Label(this);
  this.targetImage_Label.text          = "Target View:";
  this.targetImage_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
  this.targetImage_Label.minWidth      = labelWidth1;

  this.targetImage_ViewList = new ViewList(this);
  this.targetImage_ViewList.getAll();
  this.targetImage_ViewList.minWidth       = 300;
  this.targetImage_ViewList.currentView    = data.targetView;
  this.targetImage_ViewList.toolTip        = "<p>Select an image to generate a PSF for</p>";
  this.targetImage_ViewList.onViewSelected = function(view) {
    data.targetView = view;
  };

  this.targetImage_Sizer = new HorizontalSizer;
  this.targetImage_Sizer.spacing = 4;
  this.targetImage_Sizer.add(this.targetImage_Label);
  this.targetImage_Sizer.add(this.targetImage_ViewList, 100);

  //-------------------------------------------------------
  // Trim left
  //-------------------------------------------------------
  this.left_Control                 = new NumericControl(this);
  this.left_Control.real            = true;
  this.left_Control.label.text      = "Left:";
  this.left_Control.label.minWidth  = labelWidth1;
  this.left_Control.toolTip         = "<p>Trim pixels on left of non zero area.</p>";
  this.left_Control.onValueUpdated  = function(value) {data.left = value;};
  this.left_Control.setRange(0, 50);
  this.left_Control.slider.setRange(0, 50);
  this.left_Control.setPrecision(0);
  this.left_Control.slider.minWidth = 200;
  this.left_Control.setValue(data.left);

  //-------------------------------------------------------
  // Trim right
  //-------------------------------------------------------
  this.right_Control                 = new NumericControl(this);
  this.right_Control.real            = true;
  this.right_Control.label.text      = "Right:";
  this.right_Control.label.minWidth  = labelWidth1;
  this.right_Control.toolTip         = "<p>Trim pixels on right of non zero area.</p>";
  this.right_Control.onValueUpdated  = function(value) {data.right = value;};
  this.right_Control.setRange(0, 50);
  this.right_Control.slider.setRange(0, 50);
  this.right_Control.setPrecision(0);
  this.right_Control.slider.minWidth = 200;
  this.right_Control.setValue(data.right);

  //-------------------------------------------------------
  // Trim top
  //-------------------------------------------------------
  this.top_Control                 = new NumericControl(this);
  this.top_Control.real            = true;
  this.top_Control.label.text      = "Top:";
  this.top_Control.label.minWidth  = labelWidth1;
  this.top_Control.toolTip         = "<p>Trim pixels on top of non zero area.</p>";
  this.top_Control.onValueUpdated  = function(value) {data.top = value;};
  this.top_Control.setRange(0, 50);
  this.top_Control.slider.setRange(0, 50);
  this.top_Control.setPrecision(0);
  this.top_Control.slider.minWidth = 200;
  this.top_Control.setValue(data.top);

  //-------------------------------------------------------
  // Trim bottom
  //-------------------------------------------------------
  this.bottom_Control                 = new NumericControl(this);
  this.bottom_Control.real            = true;
  this.bottom_Control.label.text      = "Bottom:";
  this.bottom_Control.label.minWidth  = labelWidth1;
  this.bottom_Control.toolTip         = "<p>Trim pixels on bottom of non zero area.</p>";
  this.bottom_Control.onValueUpdated  = function(value) {data.bottom = value;};
  this.bottom_Control.setRange(0, 50);
  this.bottom_Control.slider.setRange(0, 50);
  this.bottom_Control.setPrecision(0);
  this.bottom_Control.slider.minWidth = 200;
  this.bottom_Control.setValue(data.bottom);

  //-------------------------------------------------------
  // Create the ok/cancel buttons
  //-------------------------------------------------------
  this.ok_Button         = new PushButton(this);
  this.ok_Button.text    = "OK";
  this.ok_Button.cursor  = new Cursor(StdCursor_Checkmark);
  this.ok_Button.onClick = function() { this.dialog.ok(); };

  this.cancel_Button = new PushButton(this);
  this.cancel_Button.text    = "Cancel";
  this.cancel_Button.cursor  = new Cursor(StdCursor_Crossmark);
  this.cancel_Button.onClick = function() { this.dialog.cancel(); };

  this.buttons_Sizer = new HorizontalSizer;
  this.buttons_Sizer.spacing = 6;

  // New Instance button
  this.newInstance_Button = new ToolButton( this );
  this.newInstance_Button.icon = this.scaledResource( ":/process-interface/new-instance.png" );
  this.newInstance_Button.setScaledFixedSize( 24, 24 );
  this.newInstance_Button.toolTip = "Save as Process Icon";
  this.newInstance_Button.onMousePress = function() {
    this.hasFocus = true;
    this.pushed = false;
    data.saveParameters();  // saves script data into the process icon
    this.dialog.newInstance();  // This new instance is dragged to create the new process icon
  };

  this.browseDocumentationButton = new ToolButton(this);

  this.browseDocumentationButton.icon = ":/process-interface/browse-documentation.png";
  this.browseDocumentationButton.toolTip =
  "<p>Opens a browser to view the script's documentation.</p>";
  this.browseDocumentationButton.onClick = function () {
    if (!Dialog.browseScriptDocumentation(TITLE)) {
      (new MessageBox(
        "<p>Trim the pixels at the edge of the non zero part of an image. Black pixels are ignored. Modified pixels are set to black.</p>",
        TITLE + "." + VERSION,
        StdIcon_Information,
        StdButton_Ok
      )).execute();
    }
  };


  this.buttons_Sizer.add(this.newInstance_Button);
  this.buttons_Sizer.add(this.browseDocumentationButton);

  this.resetButton = new ToolButton(this);

  this.resetButton.icon =  ":/images/icons/reset.png";
  this.resetButton.toolTip = "<p>Resets the dialog's parameters.";
  this.resetButton.onClick = function() {
    data.resetParameters(this.dialog);
  };

  this.buttons_Sizer.add(this.resetButton);


  this.buttons_Sizer.addStretch();
  this.buttons_Sizer.add(this.ok_Button);
  this.buttons_Sizer.add(this.cancel_Button);


  //-------------------------------------------------------
  // Vertically stack all the objects
  //-------------------------------------------------------
  this.sizer = new VerticalSizer;
  this.sizer.margin  = 6;
  this.sizer.spacing = 6;
  this.sizer.add(this.helpLabel);
  this.sizer.addSpacing(4);
  this.sizer.add(this.targetImage_Sizer);
  this.sizer.add(this.top_Control);
  this.sizer.add(this.bottom_Control);
  this.sizer.add(this.left_Control);
  this.sizer.add(this.right_Control);
  this.sizer.add(this.buttons_Sizer);

  //-------------------------------------------------------
  // Set all the window data
  //-------------------------------------------------------
  this.windowTitle = TITLE;
  this.adjustToContents();
  this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
trimImageDialog.prototype = new Dialog;

// Trim Image main process
function main() {
  //console.hide();

  if (ImageWindow.openWindows.length < 1) {
    (new MessageBox("ERROR: there must be at least one image open for this script to function", TITLE, StdIcon_Error, StdButton_Ok)).execute();
    return;
  }

  // Create dialog, start looping
  let data = new TrimImageData();

  if ( Parameters.isGlobalTarget || Parameters.isViewTarget ) {
    data.loadParameters();
  };

  let trimDialog = new trimImageDialog(data);
  for ( ;; ) {
    if (!trimDialog.execute())
    break;

    console.writeln("\n<b>Trim Image ", VERSION, "</b>:");

    // User must select a target view
    if (data.targetView.isNull) {
      (new MessageBox("WARNING: Target view must be selected", TITLE, StdIcon_Error, StdButton_Ok)).execute();
      continue;
    }

    // Call the layer extraction routine.
    trimImage(data);

    // Quit after successful execution.
    // break;
  }

  return;
}

main();
