/* global FrameStyle_Box, StdCursor_Checkmark, StdCursor_Crossmark, StdIcon_Information, StdButton_Ok, TextAlign_Right, TextAlign_VertCenter, Dialog, CoreApplication, StdIcon_Question, StdButton_Cancel */

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
#include <pjsr/SectionBar.jsh>

function isVersionOk(major, minor, release, revision){
    if (CoreApplication.versionMajor > major)
        return true;
    if (CoreApplication.versionMajor < major)
        return false;

    if (CoreApplication.versionMinor > minor)
        return true;
    if (CoreApplication.versionMinor < minor)
        return false;

    if (CoreApplication.versionRelease > release)
        return true;
    if (CoreApplication.versionRelease < release)
        return false;

    return (CoreApplication.versionRevision >= revision);
}

function displayVersionWarning(major, minor, release, revision){
    Console.criticalln("PixInsight version:  ", 
        CoreApplication.versionMajor, ".", CoreApplication.versionMinor,
        ".", CoreApplication.versionRelease, "-", CoreApplication.versionRevision);
    Console.criticalln("Minimum requirement: ", major, ".", minor, ".", release, "-", revision);
}
        
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
 * @param {String} scriptName If not null, display html file 
 * @param {String} okToolTip If not null, add this tooltip to ok_Button
 * (C:\Program Files\PixInsight\doc\scripts\scriptName\scriptName.html)
 * @returns {HorizontalSizer}
 */
function createWindowControlButtons(dialog, data, helpMsgTitle, helpMsg, scriptName, okToolTip){
    let ok_Button = new PushButton();
    ok_Button.text = "OK";
    ok_Button.icon = dialog.scaledResource( ":/icons/ok.png" );
    ok_Button.onClick = function () {
        dialog.ok();
    };
    if (okToolTip !== undefined && okToolTip !== null){
        ok_Button.toolTip = okToolTip;
    }

    let cancel_Button = new PushButton(dialog);
    cancel_Button.text = "Cancel";
    cancel_Button.icon = dialog.scaledResource( ":/icons/cancel.png" );
    cancel_Button.onClick = function () {
        dialog.cancel();
    };

    let buttons_Sizer = new HorizontalSizer(dialog);
    buttons_Sizer.spacing = 6;

    // New Instance button
    let newInstance_Button = new ToolButton(dialog);
    newInstance_Button.icon = dialog.scaledResource(":/process-interface/new-instance.png");
    newInstance_Button.setScaledFixedSize(24, 24);
    newInstance_Button.toolTip = "Save as Process Icon";
    newInstance_Button.onMousePress = function () {
        this.hasFocus = true;
        this.pushed = false;
        data.saveParameters();
        dialog.newInstance();
    };

    let browseDocumentationButton = new ToolButton(dialog);
    browseDocumentationButton.icon = dialog.scaledResource(":/process-interface/browse-documentation.png");
    browseDocumentationButton.setScaledFixedSize(24, 24);
    browseDocumentationButton.toolTip =
            "<p>Opens a browser to view the script's documentation.</p>";
    browseDocumentationButton.onClick = function () {
        if (scriptName !== undefined && scriptName !== null){
            let ok = Dialog.browseScriptDocumentation(scriptName);
            if (ok) return;
        }
        (new MessageBox(
                helpMsg,
                helpMsgTitle,
                StdIcon_Information,
                StdButton_Ok
                )).execute();
    };

    buttons_Sizer.add(newInstance_Button);
    buttons_Sizer.add(browseDocumentationButton);

    let resetButton = new ToolButton(dialog);
    resetButton.icon = dialog.scaledResource(":/images/icons/reset.png");
    resetButton.setScaledFixedSize(24, 24);
    resetButton.toolTip = 
            "<p>Resets the dialog's parameters.</p>" +
            "<p>Saved settings are also cleared.</p>";
    resetButton.onClick = function () {
        data.resetParameters(dialog);
        resetSettings();
    };
    
    let saveSettingsButton = new ToolButton(dialog);
    saveSettingsButton.icon = dialog.scaledResource(":icons/save.png");
    saveSettingsButton.setScaledFixedSize(24, 24);
    saveSettingsButton.toolTip = 
            "<p>Saves settings between sessions.</p>" +
            "<p>Use 'Reset' to clear the saved settings.</p>";
    saveSettingsButton.onClick = function () {
        let msg = "<p>The current settings will be saved between sessions until 'Reset' is selected.</p>";
        let reply = (new MessageBox(msg, "Save settings ?", 
                StdIcon_Question, StdButton_Ok, StdButton_Cancel)).execute();
        if (reply === StdButton_Ok){
            saveSettings(data);
        }
    };

    buttons_Sizer.add(resetButton);
    buttons_Sizer.add(saveSettingsButton);
    buttons_Sizer.addStretch();
    buttons_Sizer.add(ok_Button);
    buttons_Sizer.add(cancel_Button);
    return buttons_Sizer;
}

function createGroupBox(dialog, title){
    let groupBox = new GroupBox(dialog);
    groupBox.title = title;
    groupBox.sizer = new VerticalSizer;
    groupBox.sizer.margin = 6;
    groupBox.sizer.spacing = 6;
    return groupBox;
}