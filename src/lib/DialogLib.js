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
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>

/**
 * Returns the elapsed time since startTime.
 * If the elapsed time is less than a second, it is returned as milliseconds, with a 'ms' postfix.
 * Otherwise it is returned as seconds, with a 's' postfix.
 * @param {Number} startTime
 * @returns {String} Time elapsed since startTime
 */
function getElapsedTime(startTime) {
    let totalTime = new Date().getTime() - startTime;
    if (totalTime < 1000) {
        totalTime += " ms";
    } else {
        totalTime /= 1000;
        totalTime += " s";
    }
    return totalTime;
}

/**
 * @param {String} text
 * @returns {Label} label in FrameStyle_Box
 */
function createTitleLabel(text){
    let titleLabel = new Label();
    titleLabel.frameStyle = FrameStyle_Box;
    titleLabel.margin = 4;
    titleLabel.wordWrapping = true;
    titleLabel.useRichText = true;
    titleLabel.text = text;
    return titleLabel;
}

/**
 * Create HorizontalSizer that contains newInstance, documentation, Cancel & OK buttons
 * @param {Dialog} dialog
 * @param {Object} data
 * @param {String} helpMsgTitle
 * @param {String} helpMsg
 * @returns {HorizontalSizer}
 */
function createWindowControlButtons(dialog, data, helpMsgTitle, helpMsg){
    let newInstanceIcon = dialog.scaledResource(":/process-interface/new-instance.png");
    
    let ok_Button = new PushButton();
    ok_Button.text = "OK";
    ok_Button.cursor = new Cursor(StdCursor_Checkmark);
    ok_Button.onClick = function () {
        dialog.ok();
    };

    let cancel_Button = new PushButton();
    cancel_Button.text = "Cancel";
    cancel_Button.cursor = new Cursor(StdCursor_Crossmark);
    cancel_Button.onClick = function () {
        dialog.cancel();
    };

    let buttons_Sizer = new HorizontalSizer;
    buttons_Sizer.spacing = 6;

    // New Instance button
    let newInstance_Button = new ToolButton();
    newInstance_Button.icon = newInstanceIcon;
    newInstance_Button.setScaledFixedSize(24, 24);
    newInstance_Button.toolTip = "Save as Process Icon";
    newInstance_Button.onMousePress = function () {
        this.hasFocus = true;
        this.pushed = false;
        data.saveParameters();
        dialog.newInstance();
    };

    let browseDocumentationButton = new ToolButton();
    browseDocumentationButton.icon = ":/process-interface/browse-documentation.png";
    browseDocumentationButton.toolTip =
            "<p>Opens a browser to view the script's documentation.</p>";
    browseDocumentationButton.onClick = function () {
        (new MessageBox(
                helpMsg,
                helpMsgTitle,
                StdIcon_Information,
                StdButton_Ok
                )).execute();
    };

    buttons_Sizer.add(newInstance_Button);
    buttons_Sizer.add(browseDocumentationButton);

    let resetButton = new ToolButton();

    resetButton.icon = ":/images/icons/reset.png";
    resetButton.toolTip = "<p>Resets the dialog's parameters.";
    resetButton.onClick = function () {
        data.resetParameters(dialog);
    };

    buttons_Sizer.add(resetButton);
    buttons_Sizer.addStretch();
    buttons_Sizer.add(ok_Button);
    buttons_Sizer.add(cancel_Button);
    return buttons_Sizer;
}

/**
 * 
 * @param {String} label
 * @param {String} tooltip
 * @param {Number} initialValue
 * @param {Number} labelWidth
 * @param {Number} editWidth
 * @returns {NumericEdit}
 */
function createNumericEdit(label, tooltip, initialValue, labelWidth, editWidth){
    let numericEditControl = new NumericEdit();
    numericEditControl.setReal(false);
    numericEditControl.setRange(0, 100000);
    numericEditControl.setValue(initialValue);
    numericEditControl.label.text = label;
    numericEditControl.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
//    numericEditControl.label.setFixedWidth(labelWidth);
    numericEditControl.edit.setFixedWidth(editWidth);
    numericEditControl.toolTip = tooltip;
    return numericEditControl;
}