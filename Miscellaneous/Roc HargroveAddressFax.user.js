// ==UserScript==
// @name         Roc HargroveAddressFax
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  New script
// @author       You
// @include        http://*.mturkcontent.com/*
// @include        https://*.mturkcontent.com/*
// @include        http://*.amazonaws.com/*
// @include        https://*.amazonaws.com/*
// @include https://worker.mturk.com/*
// @include file://*
// @grant  GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_addValueChangeListener
// @grant GM_setClipboard
// @grant GM_xmlhttpRequest
// @grant GM_openInTab
// @grant GM_getResourceText
// @grant GM_addStyle
// @connect google.com
// @connect bing.com
// @connect yellowpages.com
// @connect *
// @require https://raw.githubusercontent.com/hassansin/parse-address/master/parse-address.min.js
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/js/MTurkScript.js
// @resource GlobalCSS https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/global/globalcss.css
// ==/UserScript==

(function() {
    'use strict';
    var my_query = {};
    var bad_urls=[];
    var MTurk=new MTurkScript(20000,500,[],begin_script,"A1SK2GV23YJWN9",true);
    var MTP=MTurkScript.prototype;
    function is_bad_name(b_name)
    {
        return false;
    }

    function query_response(response,resolve,reject,type) {
        var doc = new DOMParser()
        .parseFromString(response.responseText, "text/html");
        console.log("in query_response\n"+response.finalUrl);
        var search, b_algo, i=0, inner_a;
        var b_url="crunchbase.com", b_name, b_factrow,lgb_info, b_caption,p_caption;
        var b1_success=false, b_header_search,b_context,parsed_context,parsed_lgb;
        try
        {
            search=doc.getElementById("b_content");
            b_algo=search.getElementsByClassName("b_algo");
            lgb_info=doc.getElementById("lgb_info");
            b_context=doc.getElementById("b_context");
            console.log("b_algo.length="+b_algo.length);
	    if(b_context&&(parsed_context=MTP.parse_b_context(b_context))) {
                console.log("parsed_context="+JSON.stringify(parsed_context)); }
            if(lgb_info&&(parsed_lgb=MTP.parse_lgb_info(lgb_info))) {
                    console.log("parsed_lgb="+JSON.stringify(parsed_lgb)); }
            for(i=0; i < b_algo.length; i++) {
                b_name=b_algo[i].getElementsByTagName("a")[0].textContent;
                b_url=b_algo[i].getElementsByTagName("a")[0].href;
                b_caption=b_algo[i].getElementsByClassName("b_caption");
                p_caption=(b_caption.length>0 && b_caption[0].getElementsByTagName("p").length>0) ?
                    p_caption=b_caption[0].getElementsByTagName("p")[0].innerText : '';
                console.log("("+i+"), b_name="+b_name+", b_url="+b_url+", p_caption="+p_caption);
                if(!MTurkScript.prototype.is_bad_url(b_url, bad_urls) && !is_bad_name(b_name) && (b1_success=true)) break;
            }
            if(b1_success && (resolve(b_url)||true)) return;
        }
        catch(error) {
            reject(error);
            return;
        }
        reject("Nothing found");
        return;
    }

    /* Search on bing for search_str, parse bing response with callback */
    function query_search(search_str, resolve,reject, callback,type) {
        console.log("Searching with bing for "+search_str);
        var search_URIBing='https://www.bing.com/search?q='+
            encodeURIComponent(search_str)+"&first=1&rdr=1";
        GM_xmlhttpRequest({method: 'GET', url: search_URIBing,
                           onload: function(response) { callback(response, resolve, reject,type); },
                           onerror: function(response) { reject("Fail"); },ontimeout: function(response) { reject("Fail"); }
                          });
    }

    /* Following the finding the district stuff */
    function query_promise_then(result) {
    }

    function begin_script(timeout,total_time,callback) {
        if(timeout===undefined) timeout=200;
        if(total_time===undefined) total_time=0;
        if(callback===undefined) callback=init_Query;
        if(MTurk!==undefined) { callback(); }
        else if(total_time<2000) {
            console.log("total_time="+total_time);
            total_time+=timeout;
            setTimeout(function() { begin_script(timeout,total_time,callback); },timeout);
            return;
        }
        else { console.log("Failed to begin script"); }
    }

    function add_to_sheet() {
        var x,field;
        //update_address();
        for(x in my_query.fields) if(field=document.getElementsByName(x)[0]) field.value=my_query.fields[x];
    }

    function submit_if_done() {
        var is_done=true,x;
        add_to_sheet();
        for(x in my_query.done) if(!my_query.done[x]) is_done=false;
        if(is_done && !my_query.submitted && (my_query.submitted=true)) MTurk.check_and_submit();
    }
    function Address(text,priority) {
        console.log("# In address for "+text);
        var fl_regex=/(,\s*)?([\d]+(th|rd|nd) Fl(?:(?:oo)?r)?)\s*,/i,match;
        var floor=text.match(fl_regex);
        text=text.replace(fl_regex,",").replace(/,\s*USA$/,"").trim();
        var parsed=parseAddress.parseLocation(text);
        if(parsed&&parsed.city&&parsed.zip) {
            this.address1=(parsed.number?parsed.number+" ":"")+(parsed.prefix?parsed.prefix+" ":"")+
                (parsed.street?parsed.street+" ":"")+(parsed.type?parsed.type+" ":"")+(parsed.suffix?parsed.suffix+" ":"");
            this.address2="";
            this.address2=(parsed.sec_unit_type?parsed.sec_unit_type+" ":"")+
                (parsed.sec_unit_num?parsed.sec_unit_num+" ":"");
            if(!this.address2 || this.address2==="undefined") this.address2="";
            if(floor) this.address2=this.address2+(this.address2.length>0?",":"")+floor[1];
            if(!this.address2 || this.address2==="undefined") this.address2="";

            this.city=parsed.city?parsed.city:"";
            this.state=parsed.state?parsed.state:"";
            this.zip=parsed.zip?parsed.zip:"";
            console.log("state_map["+my_query.location+"]="+state_map[my_query.location]+", this.state="+this.state);

            if(!(state_map[my_query.location]===parsed.state)) priority*=2;
            this.priority=priority;
        }
        else if(match=text.match(/([A-Z]{1}\d{1}[A-Z]{1} \d{1}[A-Z]{1}\d{1})$/)) {
            /* Canada */
            this.zip=match[0];
            text=text.replace(/,?\s*([A-Z]{1}\d{1}[A-Z]{1} \d{1}[A-Z]{1}\d{1})$/,"");
            console.log("text="+text);
            if(match=text.match(/(?:,|\s)\s*([A-Z]+)\s*$/)) {
                this.state=match[1];
                text=text.replace(/(,|\s)\s*([A-Z]+)\s*$/,"");
            }

            console.log("text="+text);
            if(match=text.match(/^(.*),\s*([^,]*)$/)) {
                this.address1=match[1];
                this.city=match[2];
            }
            console.log("state_map[my_query.location]="+state_map[my_query.location]+", this.state="+this.state);
            if(!(state_map[my_query.location]===this.state)) priority*=2;
            this.priority=priority;

        }
        else if(true) { }
        else {
            this.priority=(1 << 25);;
        }
    }
    function update_address(address,suffix) {
        var top,x;
        top=address;
        console.log("top="+JSON.stringify(top));
        for(x in top) {
            console.log("Adding "+x+"_"+suffix);
            my_query.fields[x+"_"+suffix]=top[x]; }

    }
    function remove_phones(text,suffix,target) {
        var split=text.split(/\n/);

        var ret="",match,matched_phone=false,i;
        var pasted_name=/office_name/.test(target.name);
        for(i=0;i<split.length;i++) {
            if(i==0 && pasted_name && !/[\d]/.test(split[i])) {
                my_query.fields["office_name1_"+suffix]=split[i].trim();
                continue;
            }
            match=split[i].match(phone_re);
            if(match) {
                if(!matched_phone && (matched_phone=true)) my_query.fields["phone_"+suffix]=match[0];
                else my_query.fields["fax_"+suffix]=match[0]; }
            else {
                ret=ret+(ret.length>0?"\n":"")+split[i];
            }
        }
        console.log("Returning ret="+ret);
        return ret;
    }

    function do_address_paste(e) {
        e.preventDefault();
        var text = e.clipboardData.getData("text/plain");
        var match=e.target.name.match(/_([^_]*)$/);

        var suffix=match?match[1]:"01";
        text=remove_phones(text,suffix,e.target);
        text=text.replace(/\s*\n\s*/g,",").replace(/,,/g,",").replace(/,\s*$/g,"").trim();

        console.log("text="+text);

        update_address(new Address(text,-50),suffix);
        add_to_sheet();
     //  add_text(text);
    }

    function addr_cmp(add1,add2) {
        if(!(add1 instanceof Address && add2 instanceof Address)) return 0;
        if(add1.priority<add2.priority) return -1;
        else if(add1.priority>add2.priority) return 1;
        else return 0;
    }

    function init_Query()
    {
        console.log("in init_query rochargrove");
        var i;
        document.getElementsByName("address1_01")[0].addEventListener("paste",do_address_paste);
         document.getElementsByName("office_name1_01")[0].addEventListener("paste",do_address_paste);
        document.getElementsByName("office_name1_02")[0].addEventListener("paste",do_address_paste);

        //var wT=document.getElementById("DataCollection").getElementsByTagName("table")[0];
        //var dont=document.getElementsByClassName("dont-break-out");
        my_query={url:"",fields:
                  {},done:{},submitted:false};
	console.log("my_query="+JSON.stringify(my_query));
     //  var promise=MTP.create_promise(my_query.url,parse_hpd,parse_hpd_then);
    }

})();