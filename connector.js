// Define our custom Web Data Connector
// It uses version 2.x of the WDC sdk and targets Tableau 10.0 and later
(function(){

  var myConnector = tableau.makeConnector();
  var pyConnection = null;
  
  //--- Pryv auth setup ---//
  
  var settings = getSettingsFromURL();
  var domain = settings.domain || 'pryv.me';
  var registerUrl = 'reg.' + domain;
  var authSettings = {
    requestingAppId: 'tableau-demo',
    requestedPermissions: [
      {
        streamId: '*',
        level: 'read'
      }
    ],
    returnURL: 'self#',
    spanButtonID: 'pryv-button',
    callbacks: {
      initialization: function () {},
      needSignin: onNeedSignin,
      signedIn: onSignedIn,
      refused: function (reason) {},
      error: function (code, message) {}
    }
  };
  
  // Called when web page first loads
  // and when the Pryv auth flow returns to the page
  $(document).ready(function() {
    updateUI();
    $('#pryv-logout').click(function() {
      pryv.Auth.logout();
      resetAuthState();
    });
    pryvAuthSetup();
  });
  
  function pryvAuthSetup() {
    if (settings.username!=null && settings.auth!=null) {
      // User already provided a Pryv access, Pryv auth not needed
      var connection = new pryv.Connection(settings);
      onSignedIn(connection);
    }
    else {
      pryv.Auth.config.registerURL = {host: registerUrl, 'ssl': true};
      pryv.Auth.setup(authSettings);
    }
  }
  
  // Retrieves custom settings from URL querystring
  // Allows to adapt Pryv domain or provide an existing Pryv access
  function getSettingsFromURL() {
    var settings = {
      username : pryv.utility.urls.parseClientURL().parseQuery().username,
      auth: pryv.utility.urls.parseClientURL().parseQuery().auth,
      domain: pryv.utility.urls.parseClientURL().parseQuery().domain
    };
    return settings;
  }
  
  // Returns the current Pryv connection and is able to either:
  // - Save auth/username from current Pryv connection as Tableau credentials
  // - Or open a new Pryv connection from saved Tableau credentials
  function getPYConnection() {
    if (pyConnection) {
      // We have a Pryv connection but no saved Tableau credentials
      if (!tableau.password) {
        // Saving auth/username as Tableau credentials
        var token = pyConnection.auth;
        var domain = settings.domain || pyConnection.domain;
        var user = pyConnection.username + '.' + domain;
        saveCredentials(user, token);
      }
    }
    // We do not have a Pryv connection but saved Tableau credentials
    else if (tableau.password) {
      // Opening a new Pryv connection
      pyConnection = new pryv.Connection({
        url: 'https://' + tableau.username + '/',
        auth: tableau.password
      });
    }
    return pyConnection;
  }
  
  function resetAuthState() {
    if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
      tableau.abortForAuth();
      saveCredentials(null, null);
      pyConnection = null;
      updateUI();
    }
  }
  
  function updateUI() {
    if(tableau.password) {
      $('#submitButton').show();
      $('#pryv-logout').show();
    } else {
      $('#submitButton').hide();
      $('#pryv-logout').hide();
    }
  }
  
  // Saving Pryv username and auth token as Tableau credentials
  function saveCredentials(username, token) {
    tableau.username = username;
    tableau.password = token;
    //$('#submitButton').toggle(hasAuth);
    //$('#pryv-logout').toggle(hasAuth);
  }
  
  // Pryv callback triggered when the user need to sign in.
  function onNeedSignin(popupUrl, pollUrl, pollRateMs) {
    resetAuthState();
  }
  
  // Pryv callback triggered when the user is signed in.
  function onSignedIn(connection, langCode) {
    pyConnection = connection;
    saveCredentials(null, null);
    getPYConnection();
    tableau.abortForAuth();
    updateUI();
  }
  
  //--- Connector setup ---//
  
  // Init function for connector, called during every phase but
  // only called when running inside the simulator or tableau
  myConnector.init = function(initCallback) {
    tableau.authType = tableau.authTypeEnum.custom;

    getPYConnection();

    if (tableau.phase == tableau.phaseEnum.gatherDataPhase) {
      // If API that WDC is using has an enpoint that checks
      // the validity of an access token, that could be used here.
      // Then the WDC can call tableau.abortForAuth if that access token
      // is invalid.
    }

    // If we are not in the data gathering phase, we want to store the token
    // This allows us to access the token in the data gathering phase
    if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
      updateUI();
    }
    
    initCallback();
  };
  
  // Declare the data schema to Tableau
  myConnector.getSchema = function(schemaCallback) {
    var event_num_cols = [{
      id: "id",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "streamId",
      alias: "streamId",
      dataType: tableau.dataTypeEnum.string,
      foreignKey: {tableId: 'stream', columnId: 'id'}
    }, {
      id: "time",
      alias: "time",
      dataType: tableau.dataTypeEnum.datetime
    }, {
      id: "duration",
      alias: "duration",
      dataType: tableau.dataTypeEnum.float
    }, {
      id: "type",
      alias: "type",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "content",
      alias: "content",
      dataType: tableau.dataTypeEnum.float,
      columnRole: tableau.columnRoleEnum.measure
    }];

    var eventNumTable = {
      id: "eventNum",
      alias: "Numerical Events",
      columns: event_num_cols
    };

    var event_location_cols = [{
      id: "id",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "streamId",
      alias: "streamId",
      dataType: tableau.dataTypeEnum.string,
      foreignKey: {tableId: 'stream', columnId: 'id'}
    }, {
      id: "time",
      alias: "time",
      dataType: tableau.dataTypeEnum.datetime
    }, {
      id: "duration",
      alias: "duration",
      dataType: tableau.dataTypeEnum.float
    }, {
      id: "type",
      alias: "type",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "latitude",
      alias: "latitude",
      columnRole: "dimension",
      dataType: tableau.dataTypeEnum.float
    }, {
      id: "longitude",
      alias: "longitude",
      columnRole: "dimension",
      dataType: tableau.dataTypeEnum.float
    }];

    var eventLocationTable = {
      id: "eventLocation",
      alias: "Location Events",
      columns: event_location_cols
    };

    var stream_cols = [{
      id: "id",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "name",
      alias: "name",
      dataType: tableau.dataTypeEnum.string
    }, {
      id: "parentId",
      alias: "parentId",
      dataType: tableau.dataTypeEnum.string,
      foreignKey: {tableId: 'stream', columnId: 'id'}
    }];

    var streamTable = {
      id: "stream",
      alias: "Streams table",
      columns: stream_cols
    };
    schemaCallback([streamTable, eventNumTable, eventLocationTable]);
  };
  
  // This function actually makes the Pryv API calls, 
  // parses the results and passes them back to Tableau
  myConnector.getData = function(table, doneCallback) {
    // Multiple tables for WDC work by calling getData multiple times with a different id
    // so we want to make sure we are getting the correct table data per getData call
    switch (table.tableInfo.id) {
      case 'stream':
        getStreams(table, doneCallback);
        break;
      case 'eventNum':
        getNumEvents(table, doneCallback);
        break;
      case 'eventLocation':
        getLocationEvents(table, doneCallback);
        break;
    }
  }
  
  tableau.registerConnector(myConnector);
  
  //--- Data loaders ---//
  
  // Collects location Events
  function getLocationEvents(table, doneCallback) {
    var locationTypes = ['position/wgs84'];
    var pryvFilter = new pryv.Filter({limit: 10000, types: locationTypes});
    getEvents(pryvFilter, null, table, doneCallback);
  }
  
  // Collects numerical Events
  function getNumEvents(table, doneCallback) {
    var pryvFilter = new pryv.Filter({limit: 10000});
    var postFilter = function (event) {
      return (!isNaN(parseFloat(event.content)) && isFinite(event.content));
    };
    getEvents(pryvFilter, postFilter, table, doneCallback);
  }
  
  // Retrieves Events from Pryv
  function getEvents(pryvFilter, postFilter, table, doneCallback) {
    getPYConnection().events.get(pryvFilter, function (err, events) {
      if (err) {
        return tableau.abortWithError(err.toString());
      }
      if (events == null || events.length < 1) {
        return doneCallback();
      }
      if(postFilter) {
        events = events.filter(postFilter);
      }
      appendEvents(table, events);
      doneCallback();
    });
  }
  
  // Retrieves Streams from Pryv
  function getStreams(table, doneCallback) {
    getPYConnection().streams.get(null, function(err, streams) {
      if (err) {
        return tableau.abortWithError(err.toString());
      }
      if (streams == null || streams.length < 1) {
        return doneCallback();
      }
      
      var tableData = [];
      appendStreams(tableData, streams);
      // Fill the Table rows with Pryv data
      table.appendRows(tableData);
      doneCallback();
    });
  }
    
  // Append Pryv Streams to Tableau table
  function appendStreams(tableD, streamsArray) {
    for (var i = 0; i < streamsArray.length; i++) {
      var stream = streamsArray[i];
      tableD.push(
        {
          id: stream.id,
          parentId: stream.parentId,
          name: stream.name
        }
      );
      appendStreams(tableD, stream.children);
    }
  }
  
  // Append Pryv Events to Tableau table
  function appendEvents(table, eventsArray) {
    var tableData = [];
    for (var i = 0; i < eventsArray.length; i++) {
      var event = eventsArray[i];
      var eventData = {
        id: event.id,
        streamId: event.streamId,
        type: event.type,
        time: dateFormat(event.timeLT),
        duration: event.duration
      };
      var content = event.content;
      if(content != null && typeof content === 'object') {
        $.extend(eventData, content);
      } else {
        eventData.content = content;
      }
      tableData.push(eventData);
    }
    // Fill the Table rows with Pryv data
    table.appendRows(tableData);
  }
  
  //--- Helpers ---//
  
  // Converts Pryv timestamps to Tableau dates format
  function dateFormat(time) {
    return moment(new Date(time)).format("Y-MM-DD HH:mm:ss")
  }
  
})();