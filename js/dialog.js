'use strict';

(function() {
    $(document).ready(function() {
        tableau.extensions.initializeDialogAsync().then(function (openPayload) {
            buildDialog();
        });
    });

    // build the dialog box and ensure settings are read from the
    // UI namespace and the UI is updated
    function buildDialog() {
        var worksheetName = tableau.extensions.settings.get("worksheet");

        // populate the worksheet drop down
        let dashboard = tableau.extensions.dashboardContent.dashboard;
        dashboard.worksheets.forEach(function (worksheet) {
            if (worksheetName != undefined && worksheet.name == worksheetName) {
                $("#sheetList").append("<option value='" + worksheet.name + "' selected='true'>" + worksheet.name + "</option>");
            } else {
                $("#sheetList").append("<option value='" + worksheet.name + "'>" + worksheet.name + "</option>");
            }
        });

        if (worksheetName != undefined) {
            fieldListUpdate(worksheetName);
        }
        
        // reset field lists on worksheet change
        $("#sheetList").on('change','', function() {
            var wsheetName = $("#sheetList").val();
            fieldListUpdate(wsheetName);
        });

        // reset colours on colour range change
        $("#startLevelColourPicker").on('change','', function() {
            setColour(true);
        });
        $("#endLevelColourPicker").on('change','',function () {
            setColour(true);
        })

        // set button functions
        $('#addLevelButton').click(addLevel);
        $('#cancelButton').click(closeDialog);
        $('#saveButton').click(saveButton);
    }

    function fieldListUpdate(worksheetName) {
        // populate field names and select chose values if they exist
        var valueField = tableau.extensions.settings.get("valueField");
        var levelFields = tableau.extensions.settings.get("levelFields");

        // get dashboard and worksheet
        var dashboard = tableau.extensions.dashboardContent.dashboard;
        var worksheet = dashboard.worksheets.find(function (sheet) {
            return sheet.name === worksheetName;
        });

        // get 1 row of summary data (just to get field names)
        worksheet.getSummaryDataAsync({ maxRows: 1}).then(function (sumdata) {
            // get columns
            var worksheetColumns = sumdata.columns;
            // reset value field list
            $("#valueField").text("");
            $("#valueField").append("<option selected='true' disabled='true'>-- Select the value field --</option>");

            // reset level field list
            $("#levelField").text("");
            $("#levelField").append("<option selected='true' disabled='true'>-- Select the next level field --</option>");

            // loop over each column
            worksheetColumns.forEach(function (current_value) {
                // value field list
                if (valueField != undefined && current_value.fieldName == valueField) {
                    $("#valueField").append("<option value='" + current_value.fieldName + "' selected='true'>" + current_value.fieldName + "</option>");
                } else {
                    $("#valueField").append("<option value='" + current_value.fieldName + "'>" + current_value.fieldName + "</option>");
                }

                // level field list
                $("#levelField").append("<option value='" + current_value.fieldName + "'>" + current_value.fieldName + "</option>");
            });

            // add already defined levels
            if (levelFields != undefined) {
                // split level fields into array
                var levelFieldArr = [];
                levelFieldArr = levelFields.split("|");

                // loop over the fields and add them to the dialog box
                for (var i = 0; i < levelFieldArr.length; i++) {
                    $("#addLevelRow").before("<tr id='levelRow" + (i + 1).toString() + "'>\
                        <td>Level " + (i + 1).toString() + "</td>\
                        <td id='levelRowField" + (i + 1).toString() + "'>" + levelFieldArr[i] + "</td>\
                        <td><input type='color' id='levelRowColour" + (i + 1).toString() + "'></td>\
                        <td><button type='button' onclick='levelDelete(this);' class='btn btn-default'><span class='glyphicon glyphicon-remove' /></button></td>\
                        </tr>");
                }

                // set colours if they exist
                setColour(false);
            }

            // get background colour and set if exists
            var bgColour = tableau.extensions.settings.get("backgroundColour");
            if (bgColour != undefined) {
                $("#bgColourPicker").val(bgColour);
            }

            // get tooltip colour and set if exists
            var ttColour = tableau.extensions.settings.get("tooltipColour");
            if (ttColour != undefined) {
                $("#ttbgColourPicker").val(ttColour);
            }

            // get text size and set if exists
            var txtSize = tableau.extensions.settings.get("textSize");
            if (txtSize != undefined) {
                $("#textSize").val(txtSize);
            }

            // get text colour and set if exists
            var txtColour = tableau.extensions.settings.get("textColour");
            if (txtColour != undefined) {
                $("#textColourPicker").val(txtColour);
            }

            // get colour range and set if exists
            var stColour = tableau.extensions.settings.get("startLevelColour");
            var edColour = tableau.extensions.settings.get("endLevelColour");
            if (stColour != undefined) {
                $("#startLevelColourPicker").val(stColour);
            }
            if (edColour != undefined) {
                $("#endLevelColourPicker").val(edColour);
            }

        });

        // remove disabled attributes
        $("#valueField").removeAttr("disabled");
        $("#levelField").removeAttr("disabled");

        // enable add level button when levelfield is changed
        $("#levelField").on("change","",function() {
            $('#addLevelButton').removeAttr("disabled");
        });
    }

    function addLevel() {
        // get previous level if it exists
        var prevlevel = 0;
        var previd = $("#addLevelRow").prev().attr("id");
        if (previd != undefined && previd.startsWith("levelRow") && !isNaN(previd.replace("levelRow",""))) {
            prevlevel = parseInt(previd.replace("levelRow",""));
        }
        prevlevel += 1;
        // add level to table
        $("#addLevelRow").before("<tr id='levelRow" + prevlevel.toString() + "'> \
            <td>Level " + prevlevel.toString() + "</td>\
            <td id='levelRowField" + prevlevel.toString() + "'>" + $("#levelField").val() + "</td>\
            <td><input type='color' id='levelRowColour" + prevlevel.toString() + "' ></td>\
            <td><button type='button' onclick='levelDelete(this);' class='btn btn-default'><span class='glyphicon glyphicon-remove' /></button></td>\
            </tr>");
        // clear selection on input of new level
        $("#levelField default").attr("selected","true");

        setColour(false);
    }

    function setColour(change) {
        // get saved level colours
        var levelColourString = tableau.extensions.settings.get("levelColours");

        // split colours into array
        var levelColourArr = [];
        if (levelColourString != undefined) {
            levelColourArr = levelColourString.split("|");
        }

        // get number of levelRowField elements
        var numLevels = $("[id^=levelRowField]").toArray().length;

        // if number of levels == number of colours then assign all colours
        if (levelColourArr.length == numLevels && levelColourArr.length > 0 && !change) {
            for(var c = 0; c < levelColourArr.length; c++) {
                $("#levelRowColour" + (c + 1).toString()).val(levelColourArr[c]);
            }
        }
        // else assign colours from the range
        else {
            // get start and end range colours
            var stColour = $("#startLevelColourPicker").val();
            var edColour = $("#endLevelColourPicker").val();

            // convert to hls
            var stColourHsl = d3.color(stColour).formatHsl();
            var edColourHsl = d3.color(edColour).formatHsl();

            // create colour range
            var colourRange = d3.scaleLinear()
                        .domain([0, numLevels - 1])
                        .range([stColourHsl, edColourHsl])
                        .interpolate(d3.interpolateHcl);

            // for each level select and assing the colour from the range
            for (var i = 0; i < numLevels; i++) {

                // get specific colour from the range
                var levelColour = colourRange(i).toString();
                // convert to hex value
                var levelColourHex = d3.color(levelColour).formatHex();

                $("#levelRowColour" + (i + 1).toString()).val(levelColourHex);
            }
        }
    }

    

    function closeDialog() {
        tableau.extensions.ui.closeDialog("10");
    }

    function saveButton() {
        // save settings
        // worksheet
        tableau.extensions.settings.set("worksheet", $("#sheetList").val());
        
        // level row fields
        var levelRowFields = [];

        $("[id^=levelRowField]").each(function() {
            levelRowFields.push($(this).text());
        });

        tableau.extensions.settings.set("levelFields", levelRowFields.join("|"));

        // level colours
        var levelColours = [];
        $("[id^=levelRowColour]").each(function() {
            levelColours.push($(this).val());
        });

        tableau.extensions.settings.set("levelColours", levelColours.join("|"));
        
        // value field
        tableau.extensions.settings.set("valueField", $("#valueField").val());

        // background colour
        tableau.extensions.settings.set("backgroundColour", $("#bgColourPicker").val());

        // start range colour
        tableau.extensions.settings.set("startLevelColour", $("#startLevelColourPicker").val());

        // end range colour
        tableau.extensions.settings.set("endLevelColour", $("#endLevelColourPicker").val());

        // tooltip colour
        tableau.extensions.settings.set("tooltipColour", $("#ttbgColourPicker").val());

        // text size
        tableau.extensions.settings.set("textSize", $("#textSize").val());

        // text colour
        tableau.extensions.settings.set("textColour", $("#textColourPicker").val());

        // call saveAsync to save settings before calling closeDialog
        tableau.extensions.settings.saveAsync().then((currentSettings) => {
            tableau.extensions.ui.closeDialog("10");
        });
    }
})();