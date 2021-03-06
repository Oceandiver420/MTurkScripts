// ==UserScript==
// @name         FindCompanyEmail
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  NEEDS WORK
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
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/Govt/Government.js
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/global/Address.js
// @require https://raw.githubusercontent.com/spencermountain/compromise/master/builds/compromise.min.js
// @resource GlobalCSS https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/global/globalcss.css

// ==/UserScript==

(function() {
    'use strict';
    var my_query = {};
    var bad_urls=["/app.lead411.com",".zoominfo.com",".privateschoolreview.com",".facebook.com",".niche.com","en.wikipedia.org",".yelp.com","hunter.io",
                 ".zoominfo.com","issuu.com","linkedin.com","blogspot.com"];
    var MTurk=new MTurkScript(60000,500+Math.random()*250,[],begin_script,"AZF7IMCWJSI1Q",true);
    var MTP=MTurkScript.prototype;
    var my_email_re = /(([^<>()\[\]\\.,;:\s@"：+=\/\?%\*]{1,40}(\.[^<>\/()\[\]\\.,;:：\s\*@"\?]{1,40}){0,5}))@((([a-zA-Z\-0-9]{1,30}\.){1,8}[a-zA-Z]{2,20}))/g;

    var Email=function(email,value) {
        this.email=email;
        this.value=value;
    };


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
                console.log("parsed_context="+JSON.stringify(parsed_context));
            if(/url/.test(type) && parsed_context.url&&!MTP.is_bad_url(parsed_context.url,bad_urls,-1) && (resolve(parsed_context.url)||true)) return;

        }
            if(lgb_info&&(parsed_lgb=MTP.parse_lgb_info(lgb_info))) {
                    console.log("parsed_lgb="+JSON.stringify(parsed_lgb));
                if(/url/.test(type) && parsed_lgb.url&&!MTP.is_bad_url(parsed_lgb.url,bad_urls,-1) && (resolve(parsed_lgb.url)||true)) return;

            }
            for(i=0; i < b_algo.length; i++) {
                b_name=b_algo[i].getElementsByTagName("a")[0].textContent;
                b_url=b_algo[i].getElementsByTagName("a")[0].href;
                b_caption=b_algo[i].getElementsByClassName("b_caption");
                p_caption=(b_caption.length>0 && b_caption[0].getElementsByTagName("p").length>0) ?
                    p_caption=b_caption[0].getElementsByTagName("p")[0].innerText : '';
                console.log("("+i+"), b_name="+b_name+", b_url="+b_url+", p_caption="+p_caption);
                if(!MTurkScript.prototype.is_bad_url(b_url, bad_urls,4,2) && !is_bad_name(b_name,p_caption,i) && (b1_success=true)) break;
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
    /* A pretty good form of is_bad_name */
    function is_bad_name(b_name,p_caption,i)
    {
        var reg=/[-\s\'\"’]+/g,b_replace_reg=/\s+[\-\|–]{1}.*$/g;
        var lower_b=b_name.toLowerCase().replace(reg,""),lower_my=my_query.name.replace(/\s(-|@|&|and)\s.*$/).toLowerCase().replace(reg,"");
        if(lower_b.indexOf(lower_my)!==-1 || lower_my.indexOf(lower_b)!==-1) return false;
        b_name=b_name.replace(b_replace_reg,"");
        my_query.name=my_query.name.replace("’","\'");
        console.log("b_name="+b_name+", my_query.name="+my_query.name);
        if(MTP.matches_names(b_name,my_query.name)) return false;
        if(i===0 && b_name.toLowerCase().indexOf(my_query.name.split(" ")[0].toLowerCase())!==-1) return false;
        return true;
    }

    function is_bad_fb(b_url,b_name) {
        if(/\/(pages|groups|search|events)\//.test(b_url)) return true;
        return false;
    }
    /* Search on bing for search_str, parse bing response with callback */
    function query_search(search_str, resolve,reject, callback,type) {
        console.log("Searching with bing for "+search_str);
        var search_URIBing='https://www.bing.com/search?q='+
            encodeURIComponent(search_str)+"&first=1&rdr=1";
        GM_xmlhttpRequest({method: 'GET', url: search_URIBing,
                           onload: function(response) { callback(response, resolve, reject,type); },
                           onerror: function(response) { reject("Fail"); },
                           ontimeout: function(response) { reject("Fail"); }
                          });
    }

    /* Following the finding the district stuff */
    function query_promise_then(result) {
        my_query.done.query=true;
        console.log("Found url="+result+", calling");
        my_query.url=result;


    }
    function url_promise_then(result) {
        my_query.done.url=true;
        console.log("Found url="+result+", calling");
        my_query.fields.website=result;
        //MTurk.queryList.push(result);
        my_query.url=result;
        call_contact_page(result,submit_if_done);
        submit_if_done();


    }

    function fb_promise_then(result) {
        var url=result.replace(/m\./,"www.").
        replace(/facebook\.com\/([^\/]+).*$/,"facebook.com/pg/$1").replace(/\/$/,"")+"/about/?ref=page_internal";
        my_query.fb_url=url;
        console.log("FB promise_then, new url="+url);
        var promise=MTP.create_promise(url,MTP.parse_FB_about,parse_fb_about_then);

    }

    function parse_fb_about_then(result) {
        console.log("result="+JSON.stringify(result));
        my_query.done.fb=true;
        if(result.team.length>0) {
            var fullname=MTP.parse_name(result.team[0]);
            my_query.fields.first=fullname.fname;
        }
        if(result.email) {
            my_query.email_list.push(result.email);
            evaluate_emails(submit_if_done);
           /* if(!(my_query.fields.email.length>0 && /info@/.test(result.email))) {
                my_query.fields.email=result.email; }*/
            my_query.done.url=true;
        }
        else {
            if(result.url && !MTP.is_bad_url(result.url,bad_urls,-1)) query_promise_then(result.url);
            else
            {

            }
            console.log("Calling submit_if_done from parse_fb_about_then");
            submit_if_done();
        }
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
           my_query.fields.emailAddress=my_query.fields.email;
        for(x in my_query.fields) {
            if((MTurk.is_crowd && (field=document.getElementsByName(x)[0])) ||
               (!MTurk.is_crowd && (field=document.getElementById(x)))) field.value=my_query.fields[x];
        }
    }

    function submit_if_done() {
        var is_done=true,x,is_done_dones;
        add_to_sheet();
         if(MTurk.queryList.length>0 && MTurk.doneQueries>=MTurk.queryList.length) {
            my_query.done.url=true; }
        if(my_query.done.url && !my_query.found_fb) my_query.done.fb=true;
        console.log("my_query.done="+JSON.stringify(my_query.done)+"\ndoneQueries="+MTurk.doneQueries+", total="+MTurk.queryList.length);
        for(x in my_query.done) if(!my_query.done[x]) is_done=false;

        console.log("is_done="+is_done+", MTurk.queryList.length="+MTurk.queryList.length);
        if(is_done && MTurk.doneQueries>=MTurk.queryList.length&&
           !my_query.submitted && (my_query.submitted=true)) {
            if(my_query.old_blogspot && my_query.fields.email.length===0) {
                my_query.fields.email="NA";
                add_to_sheet(); }

            if(my_query.fields.email.length>0) MTurk.check_and_submit();
            else {
                console.log("Insufficient info found, returning");
                GM_setValue("returnHit"+MTurk.assignment_id,true);
                return;
            }
        }
    }

    /* Do the nlp part */
    var do_nlp=function(text,url) {
        var nlp_temp,j,k,i;
        //console.log("text="+text);
        var text_split=text.split(/(\s+[–\-\|]+|,)\s+/);
        for(i=0;i<text_split.length;i++) {
            if(/(^|[^A-Za-z]+)(Blog)($|[^A-Za-z]+)/i.test(text_split)) continue;
            nlp_temp=nlp(text_split[i]).people().out("terms");
            console.log("out="+JSON.stringify(nlp_temp));
            if(nlp_temp.length===2 && nlp_temp[0].tags.includes("FirstName") && nlp_temp[nlp_temp.length-1].tags.includes("LastName") &&
              !nlp_temp[nlp_temp.length-1].tags.includes("Comma") && !nlp_temp[nlp_temp.length-1].tags.includes("ClauseEnd")
              && !nlp_temp[0].tags.includes("Possessive") && !nlp_temp[nlp_temp.length-1].tags.includes("Possessive") &&
               nlp_temp[nlp_temp.length-1].text.toLowerCase()===nlp_temp[nlp_temp.length-1].normal.toLowerCase() &&
               nlp_temp[nlp_temp.length-1].normal!=="park" && !nlp_temp[0].tags.includes("ClauseEnd") &&
               !/(ing$)|academy|location|street|schools|christian|high/.test(nlp_temp[nlp_temp.length-1].normal)
               &&!/location|street|christian|high|west|east|north|south|dallas|trenton/.test(nlp_temp[0].normal)
              ) {
                my_query.fields.first=nlp_temp[0].text;
                return;
            }
        }


    };


    function is_bad_page(doc,title,url) {
        var links=doc.links,i,scripts=doc.scripts;
        var iframes=doc.querySelectorAll("iframe");
        for(i=0;i<iframes.length;i++) {
            if(iframes[i].src&&/parked\-content\.godaddy\.com/.test(iframes[i].src)) {
                console.log("iframes, godaddy"); return true; }
        }
        if(/hugedomains\.com|qfind\.net|\?reqp\=1&reqr\=/.test(url)||/is for sale/.test(title)) {
            console.log("bad domain style "+url+", title"); return true; }
        else if(/Expired|^404$|Error/.test(title)) { console.log("Expired|Error|404");  return true; }
//        else if(doc.querySelector("div.leftblk h3.domain_name")) return true;
        if(/^(IIS7)/.test(title.trim())) { console.log("IIS7|404"); return true; }
        if((doc.title===MTP.get_domain_only(url,true)&& doc.body.innerHTML.length<500)) return true;

        return false;
    }

     var call_contact_page=function(url,callback,extension) {
        console.log("in call_contact_page, url="+url+", extension="+extension);
        if(extension===undefined || extension==='') { extension='';
                                   MTurk.queryList.push(url); }
        GM_xmlhttpRequest({method: 'GET', url: url,onload: function(response) {
            var doc = new DOMParser().parseFromString(response.responseText, "text/html");
            contact_response(doc,response.finalUrl,{extension:extension,callback:callback}); },
                           onerror: function(response) {
                               console.log("Fail");

                               MTurk.doneQueries++;
                               callback();
                           },
                           ontimeout: function(response) {
                               console.log("Fail timeout");
                               MTurk.doneQueries++;
                               callback(); }
                          });
    };
    /* If it's a good link to follow in the search for emails */
    function good_link_to_follow(l,depth) {
        var contact_regex=/(Contact|(^About)|Legal|Team|Staff|Faculty|Teacher)/i,bad_contact_regex=/(^\s*(javascript|mailto|tel):)|(\.pdf$)/i;
        var contact2_regex=/^(Contact( Us)?)/;

        if(depth===0 && ((contact_regex.test(l.innerText)||/\/(contact)/i.test(l.href))
                && !bad_contact_regex.test(l.href))) return true;
        if(depth===0 && (MTP.get_domain_only(my_query.url,true)===MTP.get_domain_only(l.href,true) && /^(Terms|Privacy)/.test(l.innerText)
           && !bad_contact_regex.test(l.href))) return true;
      //  if(depth>0 && contact2_regex.test(l.innerText) && !bad_contact_regex.test(l.href)) return true;
     //   console.log("l.innerText="+l.innerText);
        return false;
    }

    function is_contact_form(the_form) {
        var found={"name":false,"email":false,"phone":false,"message":false};
        // regexs to link to founds
        var found_res={"name":/Name/i,"email":/^E(-)?mail/i,"phone":/Phone/i,"message":/Message|Comments/i};
        var inp,lbl,i;
        var ct=0,x;

        for(inp of the_form.querySelectorAll("input,textarea")) {
            for(x in found_res) {
                if(inp.name && found_res[x].test(inp.name)) found[x]=true; }
            if(!inp.labels) continue;
            for(i=0;i<inp.labels.length;i++) {
                lbl=inp.labels[i];
                console.log("#lbl="+lbl.innerText);
                for(x in found_res) {
                    if(found_res[x].test(lbl.innerText)) found[x]=true; }
            }
        }
        console.log("form "+the_form.name+", found="+JSON.stringify(found));
        /* Check for 3 of 4 */
        for(x in found) if(found[x]) ct++;
        return ct>=3;
    }

    function check_url_for_contact_form(doc,url) {
        var form=doc.querySelectorAll("form"),btn;
        if((btn=doc.querySelector("button.g-recaptcha")) && (btn.innerText==="Submit")) my_query.contact_url=url;
        //if(!/\/contact/.test(url)) return;
        form.forEach(function(elem) {
            if(is_contact_form(elem)&&(my_query.domain===MTP.get_domain_only(url,true))) my_query.contact_url=url;
        });

//        if(submit) my_query.contact_url=url;
    }
    // Fix in case it gets older, also make into a library
    function check_old_blogspot(doc,url) {
        var datehead,year;
        url=url.replace(/\/$/,"");
        console.log("check_old_blogspot, url="+url);
        if(!/blogspot\.com$/.test(url)) return;
        datehead=doc.querySelector(".date-header");
        if(datehead && (year=parseInt(datehead.innerText.trim().match(/[\d]{4,}$/)))) {
            console.log("check_old_blogspot, year="+year);
            if(year<2019) my_query.old_blogspot=true;
        }
    }

    /**
 * contact_response Here it searches for an email TODO:FIX */
    var contact_response=function(doc,url,extra) {
        console.log("in contact_response,url="+url);

        var i,j, my_match,temp_email,encoded_match,match_split;
        var extension=extra.extension,callback=extra.callback,nlp_temp;
        var begin_email=my_query.fields.email,title_result;
        if(extension===undefined) extension='';
        if(is_bad_page(doc,doc.title,url) && MTP.get_domain_only(url,true)===my_query.domain) {
            my_query.fields.email="NA";
        }
        // Check for a contact form
        check_url_for_contact_form(doc,url);
        // check if it's an old blogspot
        check_old_blogspot(doc,url);
        if(/wix\.com/.test(url)) {
            callback();
            return; }
        var x,scripts=doc.scripts,style=doc.querySelectorAll("style");
        MTP.fix_emails(doc,url);
        for(x=0;x<style.length;x++) { style[x].innerHTML=""; }


        console.log("in contact_response "+url);
        var short_name=url.replace(my_query.url,""),links=doc.links,email_matches,phone_matches;
        var replacement=url.match(/^https?:\/\/[^\/]+/)[0];
        var contact_regex=/(Contact|(^About)|Legal|Team|Staff|Faculty|Teacher)/i,bad_contact_regex=/^\s*(javascript|mailto|tel):/i;
        var contact2_regex=/^(Contact( Us)?)/;
        console.log("replacement="+replacement);
        var temp_url,curr_url;
        doc.body.innerHTML=doc.body.innerHTML.replace(/\s*([\[\(]{1})\s*at\s*([\)\]]{1})\s*/,"@")
            .replace(/\s*([\[\(]{1})\s*dot\s*([\)\]]{1})\s*/,".").replace(/dotcom/,".com");
        MTP.fix_emails(doc,url);
        if(my_query.fields.email.length===0 && (email_matches=doc.body.innerHTML.match(email_re))) {
            my_query.email_list=my_query.email_list.concat(email_matches);

            //console.log("Found email hop="+my_query.fields.email);
        }

        if(phone_matches=doc.body.innerText.match(phone_re)) my_query.fields.phoneNumber=phone_matches[0];
        for(i=0; i < links.length; i++)
        {
            if(/instagram\.com\/.+/.test(links[i].href) && !/instagram\.com\/[^\/]+\/.+/.test(links[i].href) && my_query.done["insta"]===undefined) {
                my_query.done["insta"]=false;
                console.log("***** FOUND INSTAGRAM "+links[i].href);
                var temp_promise=MTP.create_promise(links[i].href,MTP.parse_instagram,parse_insta_then); }
             if(/facebook\.com\/.+/.test(links[i].href) && (/\/pages\//.test(links[i].href) || !MTP.is_bad_fb(links[i].href)) &&
               my_query.fb_url.length===0 && !my_query.found_fb) {
                console.log("FOUND FB");
                my_query.found_fb=true;
                my_query.done.fb=false;
                my_query.fb_url=links[i].href.replace(/\?.*$/,"").replace(/\/pages\/([^\/]*)\/([^\/]*)/,"/$1-$2");
                fb_promise_then(my_query.fb_url);
            }
            //console.log("i="+i+", text="+links[i].innerText);
            links[i].href=MTurkScript.prototype.fix_remote_url(links[i].href,url);
            var depth=extension===''?0:1;
            if(good_link_to_follow(links[i],depth)
             &&
               !MTurk.queryList.includes(links[i].href)) {
                MTurk.queryList.push(links[i].href);
                console.log("*** Following link labeled "+links[i].innerText+" to "+links[i].href);
                call_contact_page(links[i].href,callback,"NOEXTENSION");
                continue;
            }

            //if(my_query.fields.email.length>0) continue;
            if(links[i].dataset.encEmail && (temp_email=MTP.swrot13(links[i].dataset.encEmail.replace(/\[at\]/,"@")))
               && !MTP.is_bad_email(temp_email)) my_query.email_list.push(temp_email.toString());
            if(links[i].href.indexOf("cdn-cgi/l/email-protection#")!==-1 && (encoded_match=links[i].href.match(/#(.*)$/)) &&
               (temp_email=MTP.cfDecodeEmail(encoded_match[1]).replace(/\?.*$/,"")) &&
               !MTurkScript.prototype.is_bad_email(temp_email)) my_query.email_list.push(temp_email.toString());
            else if(links[i].dataset!==undefined && links[i].dataset.cfemail!==undefined && (encoded_match=links[i].dataset.cfemail) &&
               (temp_email=MTurkScript.prototype.cfDecodeEmail(encoded_match[1]).replace(/\?.*$/,"")) &&
               !MTurkScript.prototype.is_bad_email(temp_email)) my_query.email_list.push(temp_email.toString());
            if((temp_email=links[i].href.replace(/^mailto:\s*/,"").match(email_re)) &&
               !MTurkScript.prototype.is_bad_email(temp_email[0])) my_query.email_list.push(temp_email.toString());
            if(links[i].href.indexOf("javascript:location.href")!==-1 && (temp_email="") &&
               (encoded_match=links[i].href.match(/String\.fromCharCode\(([^\)]+)\)/)) && (match_split=encoded_match[1].split(","))) {
                for(j=0; j < match_split.length; j++) temp_email=temp_email+String.fromCharCode(match_split[j].trim());
                my_query.email_list.push(temp_email.toString());
            }
            if(links[i].href.indexOf("javascript:DeCryptX(")!==-1 &&
               (encoded_match=links[i].href.match(/DeCryptX\(\'([^\)]+)\'\)/))) my_query.email_list.push(encoded_match[1]);
            if(/^tel:/.test(links[i].href)) my_query.fields.phoneNumber=links[i].href.replace(/^tel:/,"");
            //if(email_re.test(temp_email) && !my_query.email_list.includes(temp_email)) my_query.email_list.push(temp_email);

        }
        if(my_query.domain==="blogspot.com") do_asidelinks(doc,url,callback);
        console.log("* doing doneQueries++ for "+url);
        MTurk.doneQueries++;
        if(begin_email.length===0 && my_query.fields.email.length>0) my_query.fields.url=url;
        console.log("Calling evaluate emails from contact_response");
        evaluate_emails(callback);
        return;
    };

    function do_asidelinks(doc,url,callback) {
        var bad_contact_regex=/^\s*(javascript|mailto|tel):/i;
        let asidelinks=doc.querySelectorAll("aside .Image .widget-content a,aside .Text .widget-content a"),curr_aside;
        for(curr_aside of asidelinks) {
            if(!MTP.is_bad_url(curr_aside.href,bad_urls,5,2) && !bad_contact_regex.test(curr_aside.href) &&
               !MTurk.queryList.includes(curr_aside.href)) {
                MTurk.queryList.push(curr_aside.href);
                console.log("*** Following ASIDE link labeled "+curr_aside.innerText+" to "+curr_aside.href);
                call_contact_page(curr_aside.href,callback,"NOEXTENSION");

            }
        }
    }



    function remove_dups(lst) {
        console.log("in remove_dups,lst="+JSON.stringify(lst));
        for(var i=lst.length;i>0;i--) if(typeof(lst[i])!=="string"||(typeof(lst[i-1]==="string") &&
            lst[i].toLowerCase()===lst[i-1].toLowerCase())) lst.splice(i,1);
    }
    /* Evaluate the emails with respect to the name */
    function evaluate_emails(callback) {
      //  console.log("name="+JSON.stringify(my_query.fullname));
        for(i=0;i<my_query.email_list.length;i++) {
            my_query.email_list[i]=my_query.email_list[i].replace(/^[^@]+\//,"").replace(/(\.[a-z]{3})yX$/,"$1"); }
        my_query.email_list.sort(function(a,b) {
            try {
                if(a.split("@")[1]<b.split("@")[1]) return -1;
                else if(a.split("@")[1]>b.split("@")[1]) return 1;
                if(a.split("@")[0]<b.split("@")[0]) return -1;
                else if(a.split("@")[0]>b.split("@")[0]) return 1;
                else return 0;
            }
            catch(error) { return 0; }
        });
        remove_dups(my_query.email_list);
        console.log("my_query.email_list="+JSON.stringify(my_query.email_list));
        var my_email_list=[],i,curremail;
        my_query.fullname={fname:my_query.fields.first,lname:""};
        var fname=my_query.fullname.fname.replace(/\'/g,""),lname=my_query.fullname.lname.replace(/\'/g,"");

        var email_regexps=
            [new RegExp("^"+fname.charAt(0)+"(\\.)?"+lname+"@","i"),new RegExp("^"+fname+"[\\._]{1}"+lname+"@","i"),
             new RegExp("^"+fname+lname.charAt(0)+"@","i"),new RegExp("^"+lname+fname.charAt(0)+"@","i"),new RegExp("^"+my_query.fullname.fname+"@")];
        // Judges the quality of an email
        function EmailQual(email) {
            this.email=email.replace(/^20/,"");
            this.domain=email.replace(/^[^@]*@/,"");
            this.quality=0;
            if(/wix\.com/.test(this.email)) return;

            if(/^(info|contact|admission|market|cancel|support|customersupport|feedback)/.test(email)) this.quality=1;
            else this.quality=2;
            if(new RegExp(my_query.fullname.fname,"i").test(email)) this.quality=3;
            if(new RegExp(my_query.fullname.lname.substr(0,5),"i").test(email)) {
                this.quality=4;
                if(email.toLowerCase().indexOf(my_query.fullname.lname.replace(/\'/g,"").toLowerCase())>0 &&
                   my_query.fullname.fname.toLowerCase().charAt(0)===email.toLowerCase().charAt(0)) this.quality=5;
            }
            for(var i=0;i<email_regexps.length;i++) if(email_regexps[i].test(email)) this.quality=6;
            if(this.email.replace(/^[^@]*@/,"")===MTP.get_domain_only(my_query.url,true)) this.quality+=5;
            if(/^(abuse|privacy)/.test(this.email)) this.quality=-1;
            if(/noreply@blogger.com/.test(this.email)) this.quality=-1;

        }
        for(i=0;i<my_query.email_list.length;i++) {
           // console.log("my_query.email_list["+i+"]="+typeof(my_query.email_list[i]));
            if(MTP.is_bad_email(my_query.email_list[i])) continue;
            curremail=new EmailQual(my_query.email_list[i].trim());
            if(curremail.quality>0) my_email_list.push(curremail);
        }
        my_email_list.sort(function(a, b) { return b.quality-a.quality; });
        console.log("my_email_list="+JSON.stringify(my_email_list));
        if(my_email_list.length>0) {
            my_query.fields.email=my_email_list[0].email;
            console.log("my_email_list.length>0, calling submit_if_done from evaluate_emails");
            callback();
            return true;
        }
        console.log("my_email_list.length=0, calling submit_if_done from evaluate_emails");

        callback();
    }

    function parse_insta_then(result) {
        console.log("insta_result="+JSON.stringify(result));
        if(result.email) {
             my_query.email_list.push(result.email);
            console.log("Calling evaluate emails, parse_insta_then");
            evaluate_emails(submit_if_done);
        }
       // if(result.email&&my_query.fields.email.length===0) { my_query.fields.email=result.email; }
        my_query.done["insta"]=true;
        console.log("Calling submit_if_done, parse_insta_then");

        submit_if_done();
    }


    function paste_name(e) {
        e.preventDefault();
        var text = e.clipboardData.getData("text/plain").trim();
        var fullname=MTP.parse_name(text);
        my_query.fields.first=fullname.fname;
       // my_query.fields["last name"]=fullname.lname;
        add_to_sheet();
    }
    function gov_promise_then(my_result) {
        var i,curr,fullname,x,num;
        my_query.done.gov=true;
        console.log("\n*** Gov.phone="+Gov.phone);
        var result=Gov.contact_list;
        var temp;
         var person_list=[];
    console.log("Gov result="+JSON.stringify(result));

         var type_lists={"Records":{lst:[],num:'3'},"Administration":{lst:[],num:'2'},"IT":{lst:[],num:'1'},"Communication":{lst:[],num:''}}
         for(i=0;i<result.length;i++) {
             temp=new PersonQual(result[i]);
             console.log("("+i+"), "+JSON.stringify(temp));
             if(temp.quality>0) {
                 person_list.push(temp); }
         }
         person_list.sort(cmp_people);
        my_query.person_list=person_list;
        console.log("Calling submit if done from gov_promise_then");
         submit_if_done();

//        console.log("result="+JSON.stringify(result));
    }

    function PersonQual(curr) {
        //this.curr=curr;
        var fullname;
        var terms=["name","title","phone","email"],x;
        var bad_last=/^(place|street)/i;
        this.last="";
        this.first="";
        for(x of terms) this[x]=curr[x]?curr[x]:"na";
        if(this.title) this.title=this.title.replace(/^[^A-Za-z]+/,"").replace(/[^A-Za-z]+$/,"");
        if(this.name) {
            this.name=this.name.replace(/^By /,"").replace(/^[^A-Za-z]+/,"");
            fullname=MTP.parse_name(curr.name);
            this.first=fullname.fname;
            this.last=fullname.lname;
        }
        if((!this.phone ||this.phone==="na") && Gov.phone) this.phone=Gov.phone;
        this.quality=0;
        if(curr.title) {
            if(/Director|Manager|President|CEO|Officer|Owner/.test(curr.title)) this.quality=3;
            else if(/Admin|Administrator|Supervisor|Manager|Director|Founder|Owner|Officer|Secretary|Assistant/.test(curr.title)) this.quality=1;
        }

      //  if(this.email && this.email.indexOf("@")!==-1) this.quality+=5;
        var nlp_out=nlp(this.name).people().out('terms');
        if(nlp_out&&nlp_out.length>0) {
            console.log("GLunch");
            //console.log(nlp_out);

            this.quality+=2;
        }
        else this.quality=0;
        if(this.email && MTP.get_domain_only(my_query.url,true)===this.email.replace(/^[^@]*@/,"")) this.quality+=1;
        if(!this.email || this.email==="na") this.quality=-1;
        if(/[\d\?:]+/.test(this.name)) this.quality=-1;
        if(this.name.split(" ").length>4) this.quality=-1;
        else if(MTP.is_bad_email(this.email)) this.quality=-1;
        else if(bad_last.test(this.last)) this.quality=-1;

    }
    function cmp_people(person1,person2) {
        if(!(person1 instanceof PersonQual && person2 instanceof PersonQual)) return 0;
        if(person2.quality!=person1.quality) return person2.quality-person1.quality;
        else if(person2.email && !person1.email) return 1;
        else if(person1.email && !person2.email) return -1;
        else return 0;

    }

    function parse_michael_benson_params() {
        var strong=document.querySelector("form strong");
        var split=strong.innerText.trim().split("\n");
        my_query.name=split[0].trim();
        my_query.address=new Address(split[1].trim());
        if(my_query.address.state&&reverse_state_map[my_query.address.state]) my_query.state=reverse_state_map[my_query.address.state];
        else my_query.state="";

    }

    function init_Query() {
        console.log("in init_query");
        var i,promise,st;
        bad_urls=bad_urls.concat(default_bad_urls);
       // var wT=document.getElementById("DataCollection").getElementsByTagName("table")[0];
        var stuff=document.querySelectorAll("form div div div");
        my_query={name:"",state:""
            ,fb_url:"",insta_url:"",person_list:"",found_fb:false,
                                    fields:{email:"",first:" "},done:{url:false,fb:false,gov:true},submitted:false,email_list:[],contact_url:"",
                 old_blogspot:false,alt_domains:[]};
        parse_michael_benson_params();

        console.log("my_query="+JSON.stringify(my_query));

      
        //MTurk.queryList.push(my_query.url);
        //call_contact_page(my_query.url,submit_if_done,{extension:"NOEXTENSION"});
        //call_contact_page(my_query.url.replace(/^(https?:\/\/[^\/]*).*$/,"$1"),submit_if_done);


        const urlPromise = new Promise((resolve, reject) => {
            console.log("Beginning URL search");
            query_search(my_query.name+" "+my_query.state, resolve, reject, query_response,"url");
        });
        urlPromise.then(url_promise_then)
            .catch(function(val) {
            console.log("Failed at this queryPromise " + val); GM_setValue("returnHit"+MTurk.assignment_id,true); });

        console.log("my_query="+JSON.stringify(my_query));
      /*  var dept_regex_lst=[];

        var title_regex_lst=[/Admin|Administrator|Supervisor|Manager|Director|Founder|Owner|Officer|Secretary|Assistant/i];
        //var promise=MTP.create_promise(
        var query={dept_regex_lst:dept_regex_lst,
                       title_regex_lst:title_regex_lst,id_only:false,default_scrape:false,debug:false};
        var gov_promise=MTP.create_promise(my_query.url,Gov.init_Gov,gov_promise_then,function(result) {
            console.log("Failed at Gov "+JSON.stringify(result));
            if(my_query.fields.email.length===0) my_query.fields.email="NA";
            my_query.done.gov=true;
            submit_if_done(); },query);*/


    }

})();