

// This saves a request by service name, method, params, and promise
// Todo: Make as module
function Cache() {
    var cache = [];

    this.get = function(service, method, params) {
        for (var i in cache) {
            var obj = cache[i];
            if (service != obj['service']) continue;
            if (method != obj['method']) continue;
            if ( angular.equals(obj['params'], params) ) return obj;
        }
        return undefined;
    }

    this.put = function(service, method, params, prom) {
        var obj = {};
        obj['service'] = service;    
        obj['method'] = method;
        obj['prom'] = prom;
        obj['params'] = params;
        cache.push(obj);
        //console.log('cache', cache)
    }
}


function KBCacheClient(token) {
    var token = token;

    var auth = {};
    auth.token = token;
    var fba = new fbaModelServices('https://kbase.us/services/fba_model_services/');
    //var kbws = new workspaceService('http://kbase.us/services/workspace_service/', auth);
    var kbws = new Workspace('http://140.221.84.209:7058', auth);
    //var kbws = new Workspace('http://kbase.us/services/ws/', auth);
  

    var cache = new Cache();    

    this.req = function(service, method, params) {
        //if (!params) var params = {auth: auth.token};
        //else params.auth = auth.token;  // Fixme: set auth in client object

        // see if api call has already been made        
        var data = cache.get(service, method, params);

        // return the promise ojbect if it has
        if (data) return data.prom;

        // otherwise, make request
        var prom = undefined;
        if (service == 'fba') {
            console.log('Making request:', 'fba.'+method+'('+JSON.stringify(params)+')');
            var prom = fba[method](params);
        } else if (service == 'ws') {
            console.log('Making request:', 'kbws.'+method+'('+JSON.stringify(params)+')');       
            var prom = kbws[method](params);
        }

        // save the request and it's promise objct
        cache.put(service, method, params, prom)
        return prom;
    }

    this.fbaAPI = function() {
        return fba;
    }

    this.kbwsAPI = function() {
        return kbws;
    }

    this.token = function() {
        return token;
    }

    //fixme: hacks
    projectapi()
}




function getBio(type, loaderDiv, callback) {
    var fba = new fbaModelServices('https://kbase.us/services/fba_model_services/');
//    var kbws = new workspaceService('http://kbase.us/services/workspace_service/');
    var kbws = new workspaceService('http://140.221.84.209:7058');    

    // This is not cached yet; waiting to compare performanced.
    loaderDiv.append('<div class="progress">\
          <div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style="width: 3%;">\
          </div>\
        </div>')

    var bioAJAX = fba.get_biochemistry({});

    var chunk = 250;
    k = 1;
    $.when(bioAJAX).done(function(d){
        if (type == 'cpds') {
            var objs = d.compounds; 
        } else if (type == 'rxns') {
            var objs = d.reactions;
        }
        var total = objs.length;
        var iterations = parseInt(total / chunk);
        var data = [];
        for (var i=0; i<iterations; i++) {
            var cpd_subset = objs.slice( i*chunk, (i+1)*chunk -1);
            if (type == 'cpds') {
                var prom = fba.get_compounds({compounds: cpd_subset });
            } else if (type == 'rxns') {
                var prom = fba.get_reactions({reactions: cpd_subset });
            }

            $.when(prom).done(function(obj_data){
                k = k + 1;
                data = data.concat(obj_data);
                var percent = (data.length / total) * 100+'%';
                $('.progress-bar').css('width', percent);

                if (k == iterations) {
                    $('.progress').remove();                        
                    callback(data)
                }
            });
        }
    })
}




function projectapi() {
    // workspace service endpoint & client
    //project.ws_url = "https://kbase.us/services/workspace";
    //project.ws_client = new workspaceService(project.ws_url);
    project ={}
    var auth = {}
    var token = USER_TOKEN;
    auth.token = token;

    //project.ws_url = "https://kbase.us/services/ws";
    project.ws_url = 'http://140.221.84.209:7058';
    project.ws_client = new Workspace(project.ws_url, auth);


    var legit_ws_id = /^\w+$/;

    // Fields in a workspace metadata object
    project.ws_meta_fields = ['id','owner','moddate','objects',
              'user_permission','global_permission'];

    // function used in reduce() to map ws_meta array into a dict
    var ws_meta_dict = function (ws_meta){
    return ws_meta.reduce ( function( prev, curr, index){
                    prev[project.ws_meta_fields[index]] = curr;
                    return(prev);
                },{});
    };

    // Fields in an workspace object metadata object
    project.obj_meta_fields = ['id','type','moddate','instance','command',
               'lastmodifier','owner','workspace','ref','chsum',
               'metadata'];

    // function to map obj_meta array into a dict
    var obj_meta_dict = function (obj_meta) {
    return obj_meta.reduce( function( prev, curr, index){
                    prev[project.obj_meta_fields[index]] = curr;
                    return(prev);
                },{});
    };

    // We are tagging workspaces with _SOMETHING objects to distinguish
    // project workspaces from other containers. Using this in case we
    // decide to include other types of workspaces
    
    project.ws_tag = {
    project : '_project'
    };

    project.ws_tag_type = 'KBaseNarrative.Metadata';
    project.narrative_type = 'KBaseNarrative.Narrative';


    // Fields in an empty narrative
    var empty_narrative = {type: project.narrative_type,
                           data: {nbformat: 3,
                                  nbformat_minor: 0,
                                  metadata: { format: "ipynb", 
                                           creator: "",
                                           ws_name: "",
                                           name: "", 
                                           type: "Narrative",
                                           description: "",
                                           data_dependencies: [ ]
                                        },
                                  worksheets: [
                                               {
                                                   cells: [
                                                       {
                                                           collapsed: false,
                                                           input: "",
                                                           outputs: [ ],
                                                           language: "python",
                                                           metadata: { },
                                                           cell_type: "code"
                                                       }
                                                   ],
                                                   metadata: { }
                                               }
                                           ]
                                 },
                        }




    // Empty project tag template
    var empty_proj_tag = {
        id : project.ws_tag.project,
        type : project.ws_tag_type,
        data : { description : 'Tag! You\'re a project!' },
        workspace : undefined,
        metadata : {},
        auth : undefined
    };


    // id of the div containing the kbase login widget to query for auth
    // info. Set this to a different value if the div has been named differently.
    //project.auth_div = 'login-widget';
    project.auth_div = '#signin-button';
    // Common error handler callback
    var error_handler = function() {
    // neat trick to pickup all arguments passed in
    var results = [].slice.call(arguments);
    console.log( "Error in method call. Response was: ", results);
    };

    /*
     * This is a handler to pickup get_workspaces() results and
     * filter out anything that isn't a project workspace
     * (basically only include it if it has a _project object
     * within)
     */
    var filter_wsobj = function (p_in) {

        var def_params = {callback : undefined,
                   perms : ['a'],
                   filter_tag : project.ws_tag.project};
        var p = $.extend( def_params, p_in);

        var ignore = /^core/;
        var token = $(project.auth_div).kbaseLogin('session').token;//.kbaseLogin('get_kbase_cookie').token;

        // ignore any workspace with the name prefix of "core"
        // and ignore workspace that doesn't match perms
        var reduce_ws_meta = function ( prev, curr) {
            if ( ignore.test(curr[0])) { 
                return( prev);
            }
            if ( p.perms.indexOf(curr[4]) >= 0 ) {
                return( prev.concat([curr]));
            } else {
                return( prev);
            }
       };

       // get non-core workspaces with correct permissions
       var ws_match = p.res.reduce(reduce_ws_meta,[]);
       // extract workspace ids into a list
        var ws_ids = ws_match.map( function(v) { return v[0]});

        // filter ids to only 'project' workspaces 

        /*
        console.log('ids', ws_ids)
        var proms = [];
        for (var i in ws_ids) {
            var p = project.ws_client.get_objectmeta({auth: token,
                      workspace: ws_ids[i],
                      id : project.ws_tag.project});
            proms.push(p);
        }

        $.when.apply($, proms).done(function(data) {
            console.log(data);
        })*/

        var prom = project.ws_client.list_objects({workspaces: ws_ids, type: 'KBaseNarrative.Metadata', showHidden: 1});
        $.when(prom).done(function(proj_list) {
             p.callback(proj_list);

        })

        /*
        var ws_obj_fn = ws_ids.map( function( wsid) {
            //var project.ws_client.get_objectmeta({auth: token, workspace: wsid,
            //      id : project.ws_tag.project})
            
            return project.ws_client.has_object(
                { auth: token,
                  workspace: wsid,
                  id : project.ws_tag.project,
                  type : project.ws_tag_type });
        });
        // build result, which is mapping of workspace id to metadata
        $.when.apply(null, ws_obj_fn).then(
            function() {
                var results = [].slice.call(arguments);
                var reduce_ws_proj = function(prev,curr,index) {
                    if (curr) {
                        // convert array into dict and then bind to ws_id
                        prev[ws_match[index][0]] = ws_meta_dict(ws_match[index]);
                    }  
                    return( prev);
                };
                var proj_list = results.reduce(reduce_ws_proj, {});
                // return result
                console.log('project_list', proj_list)
                p.callback(proj_list);
            },
            error_handler);
        */

    };


    // Get all the workspaces that match the values of the
    // permission array. Defaults to only workspaces that the
    // currently logged in user owns/administers
    // The callback will recieve a hash keyed on workspace
    // name, where the values are dictionaries keyed on ws_meta_fields
    // if a specific workspace name is given its metadata will be
    // returned
    project.get_projects = function( p_in ) {
        var def_params = { callback : undefined,
                   perms : ['a'],
                   workspace_id : undefined,
                   error_callback: error_handler };
        var p = $.extend( def_params, p_in);

        var token = $(project.auth_div).kbaseLogin('session').token;//.kbaseLogin('get_kbase_cookie').token;

        var META_ws;
        if ( p.workspace_id ) {
            META_ws = project.ws_client.get_workspacemeta( { workspace : p.workspace_id } );
            $.when( META_ws).then( function(result) {
                           filter_wsobj( { res: [result],
                                   callback : p.callback,
                                   perms: p.perms });
                       },
                       p.error_callback);
        } else {
            META_ws = project.ws_client.list_workspaces( {} );
            $.when( META_ws).then( function(result) {
                           filter_wsobj( { res: result,
                                   callback : p.callback,
                                   perms: p.perms });
                       },
                       p.error_callback);
        }
    };


    // Get the object metadata for the specified workspace id and return a
    // dictionary keyed on "objectId" where the
    // value is a dictionary keyed on obj_meta_fields
    project.get_project = function( p_in ) {
    var def_params = { callback : undefined,
               workspace_id : undefined,
               error_callback: error_handler };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token//.kbaseLogin('get_kbase_cookie').token;
        var ws_meta = project.ws_client.list_workspace_objects( {
                                  workspace: p.workspace_id});
    $.when( ws_meta).then( function (results) {
                   var res = {};
                   $.each( results, function (index, val) {
                           var obj_meta = obj_meta_dict( val);
                           res[val[0]] = obj_meta;
                       });
                   p.callback( res);
                   },
                   p.error_callback);
    };

    // Get the individual workspace object named. Takes names
    // in 2 parts, in the workspace_id and object_id
    // fields, and the type in the type field. Returns the
    // object as the workspace service would return it,
    // as a dict with 'data' and 'metadata' fields
    // if the type is given, it will save one RPC call,
    // otherwise we fetch the metadata for it and then
    // grab the type
    project.get_object = function( p_in ) {
    var def_params = { callback : undefined,
               workspace_id : undefined,
               object_id : undefined,
               //type : undefined,
               error_callback: error_handler
             };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token; //.kbaseLogin('get_kbase_cookie').token;
        var del_fn = project.ws_client.get_object( {
                             type: p.type,
                             workspace: p.workspace,
                             id: p.object_id });
    $.when( del_fn).then( p.callback,
                  p.error_callback);
    
    };

    // Delete the object in the specified workspace/object id and return a
    // dictionary keyed on the obj_meta_fields for the result
    project.delete_object = function( p_in ) {
    var def_params = { callback : undefined,
               workspace : undefined,
               id : undefined,
               //type: undefined,
               error_callback: error_handler };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token;//.kbaseLogin('get_kbase_cookie').token;
    var user_id = $(project.auth_div).kbaseLogin('session').user_id;//.kbaseLogin('get_kbase_cookie').user_id;

        var del_fn = project.ws_client.delete_object( {
                            type: p.type,
                            workspace: p.workspace,
                            id: p.id });
    $.when( del_fn).then( p.callback,
                  p.error_callback);
    };

    // Create an new workspace and tag it with a project tag. The name
    // *must" conform to the future workspace rules about object naming,
    // the it can only contain [a-zA-Z0-9_]. We show the error prompt
    // if it fails to conform
    // If it is passed the id of an existing workspace, add the _project
    // tag object to it
    project.new_project = function( p_in ) {
        var def_params = { callback : undefined,
                   project_id : undefined,
                   def_perm : 'n',
                   error_callback: error_handler
                 };
        var p = $.extend( def_params, p_in);
        var token = $(project.auth_div).kbaseLogin('session').token//.kbaseLogin('get_kbase_cookie').token;

        if ( legit_ws_id.test(p.project_id)) {
            // Check if the workspace exists already. If it does, then 'upgrade'
            // it by adding a _project object, if it doesn't exist yet then
            // create it, then add the _project otag
            var tag_ws = function(ws_meta) {
                var proj = $.extend(true,{},empty_proj_tag);
                proj.auth = token;
                proj.workspace = p.project_id;
                var ws_fn2 = project.ws_client.save_object( proj);
                $.when( ws_fn2 ).then( function(obj_meta) {
                               p.callback( obj_meta_dict(obj_meta));
                               },
                               p.error_callback);
            };
            // function to create workspace and populate with _project object
            var ws_fn = project.ws_client.create_workspace( {
                                    workspace : p.project_id,
                                    globalread : p.def_perm
                                    });
            var ws_exists = project.ws_client.get_workspacemeta( {workspace : p.project_id });
            $.when( ws_exists).then( tag_ws, // if exists, tag
                         function() { // else create then tag
                             $.when( ws_fn).then( tag_ws,
                                      p.error_callback);
                         });
        } else {
            p.error_callback( "Bad project id: "+p.project_id);
        }
    };

    // Delete a workspace(project)
    // will wipe out everything there, so make sure you prompt "Are you REALLY SURE?"
    // before calling this.
    // the callback gets the workspace metadata object of the deleted workspace
    project.delete_project = function( p_in ) {
    var def_params = { callback : undefined,
               project_id : undefined,
               error_callback: error_handler
             };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token//.kbaseLogin('get_kbase_cookie').token;

        if ( legit_ws_id.test(p.project_id)) {
        var ws_def_fun = project.ws_client.delete_workspace({
                                  workspace: p.project_id});
        $.when( ws_def_fun).then( p.callback,
                      p.error_callback
                    );
    } else {
        console.log( "Bad project id: ",p.project_id);
    }
    };

    // Get the permissions for a project, returns a 2 element
    // hash identical to get_workspacepermissions
    // 'default' : perm // default global perms
    // 'user_id1' : perm1 // special permission for user_id1
    // ...
    // 'user_idN' : permN // special permission for user_idN
    project.get_project_perms = function( p_in ) {
    var def_params = { callback : undefined,
               project_id : undefined,
               error_callback : error_handler
             };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token//.kbaseLogin('get_kbase_cookie').token;

    var perm_fn =  project.ws_client.get_permissions( {
                                      workspace : p.project_id });
    $.when( perm_fn).then( function(perms) {
                   p.callback( perms);
                   },
                   p.error_callback
                 );

    };


    // Set the permissions for a project, takes a project_id
    // and a perms hash that is the same as the return format
    // from get_project_perms
    // 'default' : perm // default global perms
    // 'user_id1' : perm1 // special permission for user_id1
    // ...
    // 'user_idN' : permN // special permission for user_idN
    // The return results seem to be broken
    project.set_project_perms = function( p_in ) {
    var def_params = { callback : undefined,
               project_id : undefined,
               perms : {},
               error_callback : error_handler
             };
    var p = $.extend( def_params, p_in);
    var token = $(project.auth_div).kbaseLogin('session').token;//.kbaseLogin('get_kbase_cookie').token;

    var set_perm_fn =  [];
    // If a new default permission was given push a set_global_workspace_permissions
    // call onto the function stack
    if ('default' in p.perms) {
        set_perm_fn.push( project.ws_client
                  .set_global_workspace_permissions( {
                                   workspace : p.project_id,
                                   new_permission : p.perms['default']
                                 }));
        delete( p.perms['default']);
    }
    // sort users into lists based on the permissions we are giving them
    var user_by_perm = Object.keys(p.perms).reduce(
        function(prev,curr,index) {
        if (p.perms[curr] in prev) {
            prev[p.perms[curr]].push( curr);
            return prev;
        } else {
            prev[p.perms[curr]] = [curr];
            return prev;
        }
        },
        {});

    var by_perms_fn = Object.keys( user_by_perm).map(
        function(perm) {
        return project.ws_client.set_workspace_permissions( {users: user_by_perm[perm],
                                     new_permission : perm,
                                     workspace: p.project_id
                                     });
        });
    set_perm_fn = set_perm_fn.concat(by_perms_fn);
    $.when.apply( set_perm_fn).then( function() {
                         var results = [].slice.call(arguments);
                         p.callback( results);
                     },
                     p.error_callback
                       );
    };



    // Will search the given list of project_ids for objects of type narrative
    // if no project_ids are given, then all a call will be made to get_projects
    // first - avoid doing this if possible as it will be miserably slow.
    // an array of obj_meta dictionaries will be handed to the callback
    project.get_narratives = function(p_in) {
        var def_params = { callback : undefined,
                   project_ids : undefined,
                   error_callback : error_handler,
                   type: project.narrative_type,
                   error_callback: error_handler };
        var p = $.extend( def_params, p_in);
        //var token = $(project.auth_div).kbaseLogin('session').token//kbaseLogin('get_kbase_cookie').token;
        //var user_id = $(project.auth_div).kbaseLogin('session').user_id//.kbaseLogin('get_kbase_cookie').user_id;
        
        var all_my_narratives = function (project_ids) {
            var get_ws_narr = project_ids.map( function(ws_id) {
                return(project.ws_client.list_workspace_objects({
                     workspace: ws_id, type: p.type}));
            });

            $.when.apply(null, get_ws_narr).then( function() {
                                  var results = [].slice.call(arguments);
                                  var merged = [].concat.apply([],results);
                                  var dict = merged.map( obj_meta_dict);
                                  p.callback( dict);
                                  // merge all the results into a single array
                              },
                              p.error_callback
                            );
        };

        if (p.project_ids) {
            all_my_narratives( p.project_ids);
        } else {
            project.get_projects( { callback: function (pdict) {
                        var project_names = []
                        for (var i=0; i <pdict.length;i++) {
                            project_names.push(pdict[i][7])
                        }
                        all_my_narratives(project_names);
                        }
                      });
        }
    };

    // Create an empty narrative object with the specified name. The name
    // *must" conform to the future workspace rules about object naming,
    // the it can only contain [a-zA-Z0-9_]. We show the error prompt
    // if it fails to conform

    project.new_narrative = function( p_in ) {
        //var user_id = $(project.auth_div).kbaseLogin('session').user_id//.kbaseLogin('get_kbase_cookie').user_id;
        var def_params = { callback : undefined,
                   project_id : USER_ID+":home",
                   narrative_id : undefined,
                   description : "A KBase narrative",
                   error_callback: error_handler };
        var p = $.extend( def_params, p_in);
        //var token = $(project.auth_div).kbaseLogin('session').token//.kbaseLogin('get_kbase_cookie').token;

        if ( legit_ws_id.test(p.narrative_id)) {
            var nar = $.extend(true,{},empty_narrative);
            //nar.auth = token;
            nar.data.metadata.ws_name = p.project_id;
            nar.name = p.narrative_id; 
            nar.data.metadata.name = p.narrative_id; 
            nar.data.metadata.creator = USER_ID;
            //nar.metadata = nar.data.metadata;

            var ws_fn = project.ws_client.save_objects( {workspace: p.project_id, objects: [nar]});
            $.when( ws_fn ).then( function(obj_meta) {
                          p.callback( obj_meta_dict(obj_meta));
                      },
                      p.error_callback);
        } else {
            p.error_callback( "Bad narrative_id");
        }
    
    };



}
