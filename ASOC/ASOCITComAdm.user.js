// ==UserScript==
// @name         ASOCITComAdm
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Current School Class as of 03/12/2019
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
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/ddb7809592746c7c491afcb1f08c6fa8d89ed046/js/MTurkScript.js
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/Govt/Government.js
// @require https://raw.githubusercontent.com/spencermountain/compromise/master/builds/compromise.min.js

// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/School/Schools.js
// @require https://code.jquery.com/jquery-3.3.1.min.js
// @resource GlobalCSS https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/global/globalcss.css
// ==/UserScript==

(function() {
    'use strict';
    var my_query = {};
    var bad_urls=[];
    var MTurk=new MTurkScript(20000,200,[],begin_script,"A3T3RIGHXP9IK4",false);
    var MTP=MTurkScript.prototype;

    /* LinkQual ranks link quality */
    function LinkQual(href,innerText) {
        this.href=href;
        this.innerText=innerText;
        this.quality=0;
        if(/(Staff|Employee) Directory/.test(innerText)) this.quality=4;
        else if(/Directory/.test(innerText)) this.quality=3;
        else if(/Staff/.test(innerText)) this.quality=2;
    }

    /**
     * School creates a new school query, type is a string either school or district
     * title_str is a string version of the title desired for use in internal site search queries (may need tuning
     * regarding lack of ability to get the right titles and inability to get all the results for a blank query at once)
     * title_regex is a list of RegExp for valid titles of contacts, name,street,city,state,zip are obvious
     * may add "short_name"}
     * query={type:"school|district",name:string,title_regex: [RegExp,...,],title_str:string,street:string,city:string,state:"ST",zip:str,url:url}
     *
     * if url is undefined it will do a Bing search for the url
     * Relies on MTP=MTurkScript.prototype and MTurkScript
     */
    function School(query,then_func,catch_func) {
        var x;
        this.contact_list=[];
        this.bad_urls=[".adventistdirectory.org","/alumnius.net",".areavibes.com",".biz/",".buzzfile.com",".chamberofcommerce.com",".city-data.com",".donorschoose.org",".dreambox.com",".edmodo.com",
                       ".educationbug.org",".elementaryschools.org",".estately.com",".facebook.com",".greatschools.org","//high-schools.com",
                       ".hometownlocator.com",".localschooldirectory.com",".maxpreps.com",".mapquest.com",".myatlantaareahome.com",".niche.com",
                       ".nonprofitfacts.com",".pinterest.com",".prekschools.org",
                       "/publicschoolsk12.com",".publicschoolreview.com",".ratemyteachers.com",".realtor.com",
                      ".schoolbug.org",".schoolfamily.com",".schooldigger.com","//twitter.com",".youtube.com",
                      ".teacherlists.com",".trueschools.com",".trulia.com",".usnews.com",
                      ".wagenersc.com",".wikipedia.org",".wikispaces.com",".wyzant.com",
                       ".yellowbook.com",".yellowpages.com",".yelp.com",".zillow.com"];
        this.query=query;
        this.name="";this.city="";this.state="";
        this.base="";
        this.resolve=then_func;
        this.reject=catch_func ? catch_func : MTP.my_catch_func;
        this.apptegy={parser:this.parse_apptegy,suffix:"/staff",find_base:this.find_base_apptegy};
        this.blackboard={parser:this.parse_blackboard,find_directory:this.find_dir_bb,href_rx:/.*/i,
                        text_rx:/(^Directory)|((Staff|Employee) Directory(\s|$|,))|(^Faculty$)|(^Faculty\s*(&|and)\s*Staff$)|(^Staff$)|(^Staff Contacts)/i,
                       find_base:this.find_base_blackboard};
        this.cyberschool={parser:this.parse_cyberschool,href_rx:/.*/i,text_rx:/(^Staff$)|Staff Directory/i,find_directory:this.find_dir};
        this.edlio={parser:this.parse_edlio,suffix:"/apps/staff"};
        this.educationalnetworks={parser:this.parse_educationalnetworks,suffix:"/apps/staff"};
        this.finalsite={parser:this.parse_finalsite,href_rx:/.*/i,text_rx:/Staff Directory*/i,find_directory:this.find_dir};
        this.gabbart={parser:this.parse_gabbart,href_rx:/.*/i,text_rx:/.*Directory/i,find_directory:this.find_dir};
        this.campussuite={parser:this.parse_campussuite,href_rx:/staff-directory/i,text_rx:/.*/,find_directory:this.find_dir};
        this.schoolblocks={parser:this.parse_schoolblocks,suffix:"/staff"};
        this.schoolmessenger={parser:this.parse_schoolmessenger,href_rx:/.*/i,text_rx:/^(Staff )?Directory/,find_directory:this.find_dir};
        for(x in query) this[x]=query[x];
        this.name=this.name.replace(/\s*\(.*$/,"");
       // console.log("this.title_regex.length="+this.title_regex.length);
        var self={bad_urls:this.bad_urls};
        var promise=new Promise((resolve,reject) => {
            this.init();
        });
        promise.then(then_func).catch(catch_func);


    }
    School.prototype.is_bad_link=function(url) {
        url=url.toLowerCase();
        if(/^mailto|javascript|tel/.test(url)||/\.pdf([^a-z]+|$)/.test(url)) return true;
        return false;
    };
    School.prototype.parse_none=function(doc,url,resolve,reject,self) {
        var promise_list=[],i,links=doc.links,query_list=[],schoolphone,phone;
        phone=self.find_phone(doc,url);

        for(i=0;i<links.length;i++) {
            links[i].href=MTP.fix_remote_url(links[i].href,url).replace(/\/$/,"");
            //console.log("links["+i+"].innerText="+links[i].innerText+", href="+links[i].href);
            if(MTP.get_domain_only(links[i].href,true)===MTP.get_domain_only(url,true) &&

                (self.matches_title_regex(links[i].innerText) || /(^(Admin|Contact))|Directory|Staff|About/i.test(links[i].innerText)) && !self.is_bad_link(links[i].href)
              && !query_list.includes(links[i].href)
              ) {
                console.log("@@: links["+i+"].innerText="+links[i].innerText+", href="+links[i].href+", TITLE_MATCH="+(self.matches_title_regex(links[i].innerText)));
                query_list.push(links[i].href);
                promise_list.push(MTP.create_promise(links[i].href,Gov.load_scripts,MTP.my_then_func,
                                                     MTP.my_catch_func,{})); }
        }
        //console.log("query_list="+JSON.stringify(query_list));
        Promise.all(promise_list).then(function(ret) {
            let i,curr,match;
            for(i=0;i<Gov.contact_list.length;i++) {
                curr=Gov.contact_list[i];
                console.log("Gov.contact_list["+i+"]="+JSON.stringify(curr));
                if(curr.title && self.matches_title_regex(curr.title)) {
                    if(!curr.phone && phone) curr.phone=phone;
                    if(match=curr.email.match(email_re)) curr.email=match[0];
                    self.contact_list.push(curr);
                }
            }
            resolve(self);

        });


    };

    School.prototype.find_phone=function(doc,url) {
        var schoolphone,phone,match;
        var phone_re_str_begin="(?:Tel|Telephone|Phone|Ph|P|T):\\s*";
        var phone_re_str_end="([(]?[0-9]{3}[)]?[-\\s\\.\\/]+[0-9]{3}[-\\s\\.\\/]+[0-9]{4,6}(\\s*(x|ext\\.?)\\s*[\\d]{1,5})?)";
        var ext_phone_re=new RegExp(phone_re_str_begin+phone_re_str_end+"i");
        if((schoolphone=doc.querySelector("a[href^='tel:']"))) phone=schoolphone.innerText.trim();
        if(!phone && (match=doc.body.innerHTML.match(ext_phone_re))) phone=match[1];
        return phone;
    };

        /* Converts cyberschools and IES email from encoded form */
    School.prototype.convert_cyberschools_email=function(text) {
        var split_text=[],i,ret="";
        /* map to correct character */
        function get_value(char) {
            if(/^[A-Z]+/.test(char)) return (char.charCodeAt(0)-65);
            else if(/^[a-z]+/.test(char)) return (26+char.charCodeAt(0)-97);
            else if(/^[0-9]+/.test(char)) return (52+char.charCodeAt(0)-48);
            else {
                console.log("Got a non-alphanumeric character"); return -1; }
        }
        /* get the first character */
        function get_first(text) { return text.length>=2 ? String.fromCharCode(get_value(text.charAt(0))*4+get_value(text.charAt(1))/16) : ""; }
        function get_second(text) { return text.length>=3 ? String.fromCharCode((get_value(text.charAt(1))%16)*16+get_value(text.charAt(2))/4) : ""; }
        function get_third(text) { return text.length>=4 ? String.fromCharCode((get_value(text.charAt(2))%4)*64+get_value(text.charAt(3))): ""; }
        for(i=0;i<text.length;i+=4) split_text.push(text.substr(i,4));
        for(i=0;i<split_text.length; i++) {
            split_text[i]=split_text[i].replace(/\=/g,"");
            ret=ret+get_first(split_text[i])+get_second(split_text[i])+get_third(split_text[i]);
        }
        return ret;

    };

    School.prototype.parse_cyberschool=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_cyberschool at url="+url);
        var staff=doc.querySelectorAll(".staffContainer"),i,curr,name,staffInfo,title;
        var promise_list=[],a;
        for(i=0;i<staff.length;i++) {
            staffInfo=staff[i].querySelector(".staffInfo").parentNode;
            title=staffInfo.innerText.replace(/^[^:]*:\s*/,"");
            if(self.matches_title_regex(title) && (a=staff[i].querySelector("a"))) {
                a.href=MTP.fix_remote_url(a.href,url);
                promise_list.push(MTP.create_promise(a.href,self.parse_cyberschool_profile,MTP.my_then_func,MTP.my_catch_func,self));
            }
        }
        Promise.all(promise_list).then(function() { resolve(self); });
    };
    /* Parse an individual cyberschool profile */
    School.prototype.parse_cyberschool_profile=function(doc,url,resolve,reject,self) {
        var curr={},p,i;
        var profileIntro=doc.querySelector(".profileIntro"),userTitle=doc.querySelector(".userTitle dd");
        var email=doc.querySelector(".emailAddress a"),match,name=doc.querySelector(".PR_Title");
        if(email && email.href && (match=email.href.match(/\?e\=(.*)$/))) curr.email=self.convert_cyberschools_email(match[1]);
        if(name) curr.name=name.innerText.trim();
        if(userTitle) curr.title=userTitle.innerText.trim();
        if((match=profileIntro.innerText.match(phone_re))) curr.phone=match[0].trim();
        if(curr.name && curr.title && curr.email) self.contact_list.push(curr);
        resolve("");
    };


    School.prototype.parse_finalsite=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_finalsite at url="+url);
        var items=doc.querySelectorAll(".fsElementPagination a"),promise_list=[],i;
        promise_list.push(new Promise((resolve1,reject1) =>
                                      { self.parse_finalsite_fsPageLayout(doc,url,resolve1,reject1,self); }).then(MTP.my_then_func).catch(MTP.my_catch_func));
        var my_a=doc.querySelector(".fsLastPageLink"),last,curr_href;

        if(my_a) {
            my_a.href=url+my_a.href.replace(/^[^\?]*/,"");
            last=parseInt(my_a.dataset.page);
            for(i=2;i<=last;i++) {
                curr_href=my_a.href.replace(/const_page\=[\d]+/,"const_page="+i);
                //items[i].href=url+items[i].href.replace(/^[^\?]*/,"");
                console.log("curr_href="+curr_href);
                promise_list.push(MTP.create_promise(curr_href,self.parse_finalsite_fsPageLayout,MTP.my_then_func,MTP.my_catch_func,self));
            }


        }

        console.log((promise_list.length>0?"RIGHT":"WRONG")+" TYPE of finalsite, "+promise_list.length);

        Promise.all(promise_list).then(function() { resolve(self); });

    };
    School.prototype.parse_finalsite_fsPageLayout=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_finalsite_fsPageLayout at url="+url);
        //console.log(doc.body.innerHTML);
        var items=doc.querySelectorAll(".fsConstituentItem"),i,curr={},title,phone,emailscript,match;
        var colon_re=/^[^:]*:/;
        var fsemail_re=/insertEmail\(\"([^\"]*)\",\s*\"([^\"]*)\",\s*\"([^\"]*)\"/;
        console.log("items.length="+items.length);
        for(i=0;i<items.length;i++) {
            curr={};
            curr.name=items[i].querySelector(".fsFullName a")?items[i].querySelector(".fsFullName a").innerText.trim():"";
            if((title=items[i].querySelector(".fsTitles"))) curr.title=title.innerText.replace(colon_re,"").trim();
            if((phone=items[i].querySelector(".fsPhones a"))) curr.phone=phone.innerText.trim();
            if((emailscript=items[i].querySelector(".fsEmail script")) &&
               (match=emailscript.innerHTML.match(fsemail_re))) curr.email=match[3].split("").reverse().join("")+"@"+match[2].split("").reverse().join("");;
            console.log("("+i+"), curr="+JSON.stringify(curr));
            if(curr.title && self.matches_title_regex(curr.title)) self.contact_list.push(curr);
        }
        resolve("");
    };

    School.prototype.parse_gabbart=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_gabbart at url="+url);
        var items=doc.querySelectorAll(".pagination a"),promise_list=[],i;
        promise_list.push(new Promise((resolve1,reject1) =>
                                      { self.parse_gabbart_page(doc,url,resolve1,reject1,self); }).then(MTP.my_then_func).catch(MTP.my_catch_func));
        var my_a=doc.querySelector(".fsLastPageLink"),last,curr_href;
        var url_list=[];
        for(i=0;i<items.length;i++) {
            if(items[i].href&&(items[i].href=MTP.fix_remote_url(items[i].href,url)) && !url_list.includes(items[i].href))
            {
                url_list.push(items[i].href);
                console.log("items["+i+"].href="+items[i].href);
                promise_list.push(MTP.create_promise(items[i].href,self.parse_gabbart_page,MTP.my_then_func,MTP.my_catch_func,self));
            }
        }



        console.log((promise_list.length>0?"RIGHT":"WRONG")+" TYPE of gabbart, "+promise_list.length);

        Promise.all(promise_list).then(function() { resolve(self); });

    };

    School.prototype.parse_gabbart_page=function(doc,url,resolve,reject,self) {
        var items=doc.querySelectorAll(".col-lg-4.col-sm-4.text-center"),i,curr={},name,title,phone,email,match,schoolphone;
        if((schoolphone=doc.querySelector("a[href^='tel:']"))) phone=schoolphone.innerText.trim();
        console.log("items.length="+items.length);
        for(i=0;i<items.length;i++) {
            curr={};
            if((name=items[i].querySelector("h3 a.smallTitle"))) {
                curr.name=name.innerText.trim().replace(/([^,]*),\s*(.*)$/g,"$2 $1");
                //if(fullname&&fullname.fname&&fullname.lname) curr.name=fullname.fname+" "+fullname.lname;
            }
            if(phone) curr.phone=phone;
            if((title=items[i].querySelector("h3 .capt"))) curr.title=title.innerText.trim();
            if((email=items[i].querySelector("a[href*='@']"))) curr.email=email.href.replace(/^\s*mailto:\s*/,"");
            console.log(url.replace(self.base+"/","")+": ("+i+"), curr="+JSON.stringify(curr));
            if(curr.title && self.matches_title_regex(curr.title)) self.contact_list.push(curr);
        }
        resolve("");
    };


    School.prototype.parse_campussuite=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_campussuite at url="+url);

    };

    School.prototype.fix_generator=function(generator_str) {
        var match,gen_regex=/(?:^|[^A-Za-z]{1})(Joomla|Drupal|Starfield Technologies|One\.com|Wix\.com)(?:$|[^A-Za-z]{1})/;
        if(match=generator_str.match(gen_regex)) return match[1].replace(/\.com/g,"");
        generator_str=generator_str.replace(/(^|;)Powered By /ig,"$1");
        generator_str=generator_str.replace(/\s(v\.)?[\d]+\.[\d]+[\.\d]*\s*/g,"");
        if(/^WordPress/i.test(generator_str)) generator_str=generator_str.replace(/;WordPress/ig,"");
        return generator_str;
    };


    /**
     * convert_ednetworks_email converts
     * emails for the educational networks websites (edlio some places?)
     * input value text comes from either <input type="hidden" name="e" value="([\d]+),?"> or
     * from urls with e=([\d]+)
     */
    School.prototype.convert_ednetworks_email=function(text) {
        var i, split_text=[],ret_text="",dot_char=9999,curr_char;
        /* Split into 4 character chunks */
        for(i=0; i < text.length; i+=4) split_text.push(text.substr(i,4));
        /** Take the 3rd chunk from right if smaller than 4th (i.e.in case it's .k12.XX.us) **/
        for(i=0; i < split_text.length; i++) if((curr_char=parseInt(split_text[i]))<dot_char) dot_char=curr_char;
        /* 46 is char code for "." */
        for(i=0; i < split_text.length; i++) ret_text=ret_text+String.fromCharCode(46+(parseInt(split_text[i])-dot_char)/2);
        return ret_text.replace(/^mailto:/,"");
    };
    School.prototype.parse_edlio=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_edlio at url="+url);
        var schoolphone,phone;
        if((schoolphone=doc.querySelector("a[href^='tel:']"))) phone=schoolphone.innerText.trim();
        var footer=doc.querySelector("footer"),match,promise_list=[],i,curr={},curr_elem,x;
        self.schoolPhone="";
        var my_phone_re=/(?:Phone|Tel|T):\?\s*([(]?[0-9]{3}[)]?[-\\s\\.\\/]+[0-9]{3}[-\\s\\.\\/]+[0-9]{4,6})/;
        if(footer && (match=footer.innerText.match(my_phone_re))) self.schoolPhone=match[1];
        else {
            let a=footer.querySelectorAll("a"),i;
            for(i=0;i<a.length;i++) if(/^tel/.test(a[i].href) && (self.schoolPhone=a[i].innerText)) break;
        }
        var staff=doc.querySelectorAll(".staff");
        for(i=0;i<staff.length;i++) {
           // console.log("("+i+"): "+staff[i].innerHTML);
            curr={};
            curr_elem={name:staff[i].querySelector(".name"),title:staff[i].querySelector(".user-position"),
                       phone:staff[i].querySelector(".user-phone"),email:staff[i].querySelector(".email")};
            for(x in curr_elem) curr[x]=curr_elem[x]?curr_elem[x].innerText.trim():"";
            if(/^(x|ext)/.test(curr.phone)) curr.phone=self.schoolPhone+(self.schoolPhone.length>0?" ":"")+curr.phone;
            console.log("curr_elem["+i+"]="+JSON.stringify(curr_elem)+", curr["+i+"]="+JSON.stringify(curr));
            if(self.matches_title_regex(curr.title)) {
                // check if we already can get email with no further queries

                if(curr_elem.email && curr_elem.email.href && (match=curr_elem.email.href.match(/\?e\=([\d]*)/))) {
                    console.log("Matched e=");
                    curr.email=self.convert_ednetworks_email(match[1]);
                    self.contact_list.push(curr);
                }
                else if(curr_elem.email&&curr_elem.email.href && (match=curr_elem.email.href.match(/^mailto:\s*(.*@.*)$/))) {
                    console.log("Matched mailto");

                    curr.email=match[1];
                    if(!curr.phone && phone) curr.phone=phone;
                    self.contact_list.push(curr);
                }
                else {
                    if(curr_elem.email) console.log("curr_elem.email.outerHTML="+curr_elem.email.outerHTML);
                    var the_url=MTP.fix_remote_url(staff[i].querySelector("a").href,url);
                    if(the_url.indexOf("&pREC_ID=contact")===-1) the_url=the_url+"&pREC_ID=contact";
                    console.log("the_url["+i+"]="+the_url);
                    promise_list.push(MTP.create_promise(the_url,self.parse_appsstaff_contactpage,MTP.my_try_func,MTP.my_catch_func,
                                                         {self:self,curr:curr}));
                }
            }
        }
        Promise.all(promise_list).then(function() {
            resolve(self); });
    };

    School.prototype.parse_educationalnetworks=function(doc,url,resolve,reject,self)
    {
        var promise_list=[],promise;
        var i,staff_elem=doc.getElementsByClassName("staff-categoryStaffMember"),person;
        for(i=0; i < staff_elem.length; i++) {
        //    console.log("staff_elem[i]="+staff_elem[i].innerHTML);
            var the_url=MTP.fix_remote_url(staff_elem[i].querySelector("a").href,url);
            person=self.get_appsstaff_nametitle(staff_elem[i]);
 //           console.log("the_url["+i+"]="+the_url+", person="+JSON.stringify(person));
            if(the_url.indexOf("&pREC_ID=contact")===-1) the_url=the_url+"&pREC_ID=contact";
            if(self.matches_title_regex(person.title)) {
                promise_list.push(MTP.create_promise(the_url,self.parse_appsstaff_contactpage,
                                                     MTP.my_then_func,MTP.my_catch_func,{curr:person,self:self}));
            }
        }
        Promise.all(promise_list).then(function() {
            resolve(self); });
    };



    /* Helper function to get the name and title of a staff member at ednetworks edlio schools on the appsstaff
     * page or the contact page (same format) */
    School.prototype.get_appsstaff_nametitle=function(div) {
        var dl,dt,dd,result={name:"",title:""};
        if((dl=div.getElementsByTagName("dl")).length>0) {
            if((dt=dl[0].getElementsByTagName("dt")).length>0) result.name=dt[0].innerText.trim();
            if((dd=dl[0].getElementsByTagName("dd")).length>0) result.title=dd[0].innerText.trim();
        }
        return result;
    };


    /**
     * parse_appsstaff_contactpage grabs data from a single individual's contact page in
     * create_promise form (incomplete needs work!!!)
     */
    School.prototype.parse_appsstaff_contactpage=function(doc,url,resolve,reject,extra) {
        var curr=extra.curr,self=extra.self;
        var result={name:"",email:"",phone:"",title:""},staffOverview,dl,dt,dd,i,ret;
        var contacts=doc.getElementsByClassName("staffContactWrapper"),phone_match;
        if((staffOverview=doc.getElementsByClassName("staffOverview")).length>0) {
            ret=self.get_appsstaff_nametitle(staffOverview[0]);
            result.name=ret.name;
            result.title=ret.title;
        }
        for(i=0; i < contacts.length; i++) if(phone_match=contacts[i].innerText.match(phone_re)) result.phone=phone_match[0];
        if(doc.getElementsByName("e").length>0) {
            result.email=self.convert_ednetworks_email(doc.getElementsByName("e")[0].value.replace(/,/g,""));
            self.contact_list.push(result);
        }
        resolve("");
    };
    /* Helper function to get the name and title of a staff member at ednetworks edlio schools on the appsstaff
     * page or the contact page (same format) */

    School.prototype.parse_schoolblocks=function(doc,url,resolve,reject,self) {
        console.log("in School.prototype.parse_schoolblocks at url="+url);

        var people=doc.querySelectorAll(".sb-block-container.modal-trigger"),i,title,promise_list=[];
        for(i=0;i<people.length;i++) {
            title=people[i].querySelector(".sb-teacher-card-title");
            //console.log("title["+i+"]="+title.innerText.trim());
            if((self.matches_title_regex(title.innerText.trim()))) {
              //  console.log("Matched!");
               var promise=new Promise((resolve,reject) => {
                   GM_xmlhttpRequest({method: 'GET', url: self.base+"/_!_API_!_/2/people/"+people[i].dataset.id,
                           onload: function(response) { self.parse_schoolblockperson(response, resolve, reject,self); },
                           onerror: function(response) { reject("Fail"); },ontimeout: function(response) { reject("Fail"); }
                          });            });
                promise.then(MTP.my_then_func).catch(MTP.my_catch_func);
                promise_list.push(promise);
            }
        }
        Promise.all(promise_list).then(function() { resolve(self); });
    };
    School.prototype.parse_schoolblockperson=function(response,resolve,reject,self) {
        var parsed,person;
        try {
           // console.log("response.responseText="+response.responseText);
            parsed=JSON.parse(response.responseText);
            person={name:parsed.fname&&parsed.lname?parsed.fname+" "+parsed.lname:"",
                    title:parsed.title?parsed.title:"",email:parsed.email?parsed.email:"",phone:parsed.phone?parsed.phone:""};
            //console.log("person="+JSON.stringify(person));
            self.contact_list.push(person);

        }
        catch(error) { console.log("Error parsing schoolblocksperson "+error); }
        resolve("");

    };
    School.prototype.parse_apptegy=function(doc,url,resolve,reject,self) {
        console.log("in Schools.parse_apptegy at url="+url);
        doc.querySelectorAll(".contact-info").forEach(function(elem) { self.parse_apptegy_field(elem,self); });
        resolve(self);
    };
    /* Helper to parse an individual person for Schools.parse_apptegy */
    School.prototype.parse_apptegy_field=function(elem,self) {
        var f_n={"name":"name","title":"title","phone-number":"phone","department":"department","email":"email"};
        var curr_c={},x,curr_f;
        for(x in f_n) if((curr_f=elem.getElementsByClassName(x)).length>0) curr_c[f_n[x]]=curr_f[0].innerText.trim();
        if(curr_c.title && self.matches_title_regex(curr_c.title)) self.contact_list.push(curr_c);
      // else console.log("curr_c.title="+curr_c.title);
    };

    /* toString redef */
    School.prototype.toString=function() {
        return JSON.stringify(this.query);
    };

    /* initialize the school */
    School.prototype.init=function() {
        var promise;
        this.try_count=0;
        if(this.url===undefined) { promise=MTP.create_promise(this.get_bing_str(this.name+" "+this.city+" "+reverse_state_map[this.state]+" "),
                                                            this.parse_bing,this.parse_bing_then,MTP.my_catch_func,this); }
        else promise=MTP.create_promise(this.url,this.init_SchoolSearch,this.resolve,this.reject,this);
    };
    /* TODO: tune */
    School.prototype.is_bad_name=function(b_name,p_caption) { if(/(^|[^A-Za-z]{1})(PTO|PTA)($|[^A-Za-z]{1})/.test(b_name)) return true;
                                                             return false; };
    School.prototype.get_bing_str=function(str) { return 'https://www.bing.com/search?q='+encodeURIComponent(str)+"&first=1&rdr=1"; };
    School.prototype.parse_bing_then=function(result) {
        var promise,self=result.self;
        result.self.url=result.url;
        promise=MTP.create_promise(self.url,self.init_SchoolSearch,self.resolve,self.reject,self);
    };
    School.prototype.matches_school_names=function(name1,name2) {
        var replace_list=[{re:/Independent School District/,str:"ISD"}];
        var i;
        if(MTP.matches_names(name1,name2)) return true;
        for(i=0;i<replace_list.length;i++) {
            name1=name1.replace(replace_list[i].re,replace_list[i].str);
            name2=name2.replace(replace_list[i].re,replace_list[i].str);
            if(MTP.matches_names(name1,name2)) return true;
        }
        return false;
    };

    School.prototype.parse_bing=function(doc,url,resolve,reject,self) {
        if(self.query.debug) console.log("in query_response\n"+url);

        var search, b_algo, i=0, inner_a;
        var bad_urls=self.bad_urls;
        var b_url="crunchbase.com", b_name, b_factrow,lgb_info, b_caption,p_caption;
        var b1_success=false, b_header_search,b_context,parsed_context,parsed_lgb;
        try
        {
            search=doc.getElementById("b_content");
            b_algo=search.getElementsByClassName("b_algo");
            lgb_info=doc.getElementById("lgb_info");
            b_context=doc.getElementById("b_context");
            /*console.log("b_algo.length="+b_algo.length);*/
            if(b_context&&(parsed_context=MTP.parse_b_context(b_context))) {
                console.log("parsed_context="+JSON.stringify(parsed_context));
                if(parsed_context.url&&parsed_context.Title&&!(parsed_context.SubTitle && parsed_context.SubTitle==="County") &&
              self.matches_school_names(self.query.name,parsed_context.Title)
                   &&!MTP.is_bad_url(parsed_context.url,self.bad_urls,6,3)&&
                              (resolve({url:parsed_context.url,self:self})||true)) return;
            }
            if(lgb_info&&(parsed_lgb=MTP.parse_lgb_info(lgb_info)) && parsed_lgb.url&&parsed_lgb.url.length>0 &&
              MTP.get_domain_only(window.location.href,true)!==MTP.get_domain_only(parsed_lgb.url,true)&&!MTP.is_bad_url(parsed_lgb.url,self.bad_urls,6,3)) {
                if(self.query.debug) console.log("parsed_lgb="+JSON.stringify(parsed_lgb));
                resolve({url:parsed_lgb.url,self:self});
                return;

            }
            for(i=0; i < b_algo.length&&i<10; i++)
            {
                b_name=b_algo[i].getElementsByTagName("a")[0].textContent;
                b_url=b_algo[i].getElementsByTagName("a")[0].href;
                b_caption=b_algo[i].getElementsByClassName("b_caption");
                p_caption=(b_caption.length>0 && b_caption[0].getElementsByTagName("p").length>0)?b_caption[0].getElementsByTagName("p")[0].innerText:"";
                if(self.query.debug) console.log("("+i+"), b_name="+b_name+", b_url="+b_url+", p_caption="+p_caption);
                if((!MTP.is_bad_url(b_url,self.bad_urls,6,4)||/\/vnews\/display\.v\/SEC\//.test(b_url)) && !self.is_bad_name(b_name,p_caption) && (b1_success=true)) break;
            }
            if(b1_success && (resolve({url:b_url,self:self})||true)) return;
        }
        catch(error) {
            reject(error);
            return;
        }
        if(parsed_lgb&&parsed_lgb.url&&parsed_lgb.url.length>0) resolve({url:parsed_lgb.url,self:self});
        else if(self.try_count++===0) {
            let promise=MTP.create_promise(self.get_bing_str(self.name+" "+self.city+" "+reverse_state_map[self.state]+" website"),
                                                            self.parse_bing,resolve,reject,self);
        }
        else reject("No school website found for "+self.query.name+" in "+self.query.city+", "+self.query.state);
        //        GM_setValue("returnHit",true);
        return;

    };
    School.prototype.matches_title_regex=function(title) {
        //console.log("this.title_regex="+this.title_regex);
        for(var i=0; i < this.title_regex.length; i++) {
//            console.log("this.title_regex["+i+"]="+this.title_regex[i]);

            if(title.match(this.title_regex[i])) return true; }
        return false;
    };
    School.prototype.matches_name=function(name) {
        //console.log("this.name="+this.name);
        var the_regex=/[\.\']+/g,dash_regex=/-/g,the_regex2=/ School$/;
        var short_school=this.name.replace(the_regex,"").replace(dash_regex," ").replace(the_regex2,"").toLowerCase().trim();
        var short_name=name.replace(the_regex,"").replace(dash_regex," ").replace(the_regex2,"").toLowerCase().trim();
        if(short_name.length===0) return false;
        if(short_name.indexOf(short_school)!==-1 || short_school.indexOf(short_name)!==-1) return true;
        return false;
    };
    /* Schools.call_parser is a helper function to create a promise for the school parser */
    School.prototype.call_parser=function(result) {
        var self=result.self,url=result.url,promise;
        console.log("url="+result.url+", base="+self.base);
       // console.log("self="+JSON.stringify(self));
        if(result.url!==self.base) promise=MTP.create_promise(url,self[self.page_type].parser,self.resolve,self.reject,self);
        else promise=MTP.create_promise(url,self.parse_none,self.resolve,self.reject,self);
    };
    School.prototype.find_base_blackboard=function(doc,url,resolve,reject,self) {
        var lst=doc.querySelectorAll(".schoollist a"),inner_a,i;
        var bad_regex=/(^\s*javascript|mailto)|((\.|\/)(facebook|youtube|twitter)\.com)/i;

        if(lst.length===0 && (lst=doc.querySelectorAll(".schools a")).length===0) lst=doc.querySelectorAll("a");
        var domain=MTP.get_domain_only(url,false);
       // console.log(domain+": in find_base_blackboard, lst.length="+lst.length);
        for(i=0;i<lst.length;i++) {
            lst[i].href=MTP.fix_remote_url(lst[i].href,url).replace(/\/$/,"");
           // console.log(domain+": lst["+i+"].innerText="+lst[i].innerText);
            if(self.matches_name(lst[i].innerText.trim()) && !bad_regex.test(lst[i].href)

              ) return MTP.fix_remote_url(lst[i].href,url);
        }
        return url;
    };
    School.prototype.find_base_apptegy=function(doc,url) {
        var i,h4,cols=doc.getElementsByClassName("footer-col"),list,ret;
        for(i=0; i < cols.length; i++) {
            if((h4=cols[i].getElementsByTagName("h4")).length>0 && /Schools/i.test(h4[0].innerText)
               && (list=cols[i].getElementsByClassName("footer-links")).length>0 &&
               (ret=Schools.match_in_list(list[0],url))) return ret;
        }
        return url.replace(/(https?:\/\/[^\/]+).*$/,"$1");
    };
    /* Generic find the directory location given some regexes to use */
    School.prototype.find_dir=function(doc,url,resolve,reject,self) {
        var curr_type=self[self.page_type];
        var links=doc.links,i;
        var domain=MTP.get_domain_only(url);

        for(i=0;i<links.length;i++) {
            links[i].href=MTP.fix_remote_url(links[i].href,url);
            if(MTP.get_domain_only(links[i].href)!==domain) continue;
            if(curr_type.href_rx.test(links[i].href) &&
               curr_type.text_rx.test(links[i].innerText.trim())) {
                console.log(domain+": resolving on "+links[i].innerText+",url="+links[i].href);
                resolve({url:links[i].href,self:self}); return; }
        }
        console.log(domain+": could not find, resolving on base "+url);
        resolve({url:url,self:self});
    };



    /* TODO: add priority for links */
    School.prototype.find_dir_bb=function(doc,url,resolve,reject,self) {

        var links=doc.links,i,scripts=doc.getElementsByTagName("script");
        var domain=MTP.get_domain_only(url);
        var contact,new_url;
        var good_links=[];
        var curr_type=self[self.page_type];
        console.log(domain+":curr_type="+JSON.stringify(curr_type)+", "+curr_type.text_rx);
      //  console.log(domain+"self="+JSON.stringify(self));
        for(i=0;i<links.length;i++) {
            links[i].href=MTP.fix_remote_url(links[i].href,url);
          //  console.log(domain+": links["+i+"].innerText="+links[i].innerText.trim());
            if(MTP.get_domain_only(links[i].href)!==domain) continue;
            if(/Contact Us/.test(links[i].innerText)) contact=links[i].href;
            if(
               curr_type.text_rx.test(links[i].innerText.trim()) && !/\.pdf$/.test(links[i].href)) {
                console.log(domain+": found good  "+links[i].innerText+",url="+links[i].href);
                good_links.push(new LinkQual(links[i].href,links[i].innerText));
            //    resolve({url:links[i].href,self:self}); return;
            }
        }
        if(good_links.length>0) {
            good_links.sort(function(link1,link2) {
                return link2.quality-link1.quality; });
            console.log("good_links="+JSON.stringify(good_links));
            resolve({url:good_links[0].href,self:self}); return;
        }
        if(contact) console.log(domain+": resolving on contact "+contact);
        else if((new_url=self.find_dir_bb_scripts(scripts,url,self))) {
            console.log(domain+": resolving from scripts "+new_url);
            resolve({url:new_url,self:self}); }
        else {

            console.log(domain+": could not find, resolving on base "+url);
            resolve({url:url,self:self}); }
    };
    /* Returns url if found in scripts, null otherwise */
    School.prototype.find_dir_bb_scripts=function(scripts,url,self) {
        var i,j,match,icons_regex=/menuGlobalIcons\s*\=\s*([^;]+)/,parsed;
        var staff_regex2=/\"(?:Staff )?Directory\",\s*\"(\/[^\"]*)\"/;
        for(i=0;i<scripts.length;i++) {
            if(match=scripts[i].innerHTML.match(icons_regex)) {
                parsed=JSON.parse(match[1]);
                for(j=0;j<parsed.length;j++) {
                    if(parsed[j].length>=2 && /Directory/.test(parsed[j][0])) return parsed[j][1];
                }
            }
            else if(match=scripts[i].innerHTML.match(staff_regex2)) return match[1];
        }
        return null;

    };
    School.prototype.parse_blackboard=function(doc,url,resolve,reject,self) {
        if(self.count===undefined) self.count=0;
        //console.log("doc.body.innerHTML="+doc.body.innerHTML);
        var staffdirectory=doc.querySelector(".staffdirectorydiv"),minibase=doc.querySelector(".minibase")
        var swdirectory=doc.querySelector(".sw-directory-item"),promise,footer=doc.querySelector(".gb-footer");
        var domain=MTP.get_domain_only(url),match;
        if(!footer && !(footer=doc.querySelector("#gb-footer"))) footer=doc.querySelector("footer");
        //console.log("footer.innerHTML="+footer.innerHTML);

        if(footer && (match=footer.innerText.match(/(\d{3}-\d{3}-\d{4})|(\(\d{3}\)\s*\d{3}-\d{4})/i))) self.phone=match[0].trim();
        else self.phone="";
        if(match=self.phone.match(/^(?:\()?([\d]{3})/)) self.area_code=match[1];
        else self.area_code="";
        console.log("self.phone="+self.phone+", self.area_code="+self.area_code);
        if((staffdirectory||(staffdirectory=doc.querySelector(".cs-staffdirectorydiv"))) &&
          (self.staffdirectory=staffdirectory)) self.parse_bb_staffdirectory(doc,url,resolve,reject,self);
        else if(minibase && (self.minibase=minibase)) self.parse_bb_minibase(doc,url,resolve,reject,self);
        else if(swdirectory) self.parse_bb_swdirectory(doc,url,resolve,reject,self);
        else {
            console.log(domain+":Could not identify blackboard directory type "+url);
            self.parse_none(doc,url,resolve,reject,self);

        }
       // console.log("parse_blackboard, url="+url);
    };
    /* staffdirectoryresponsivediv (type1) */
    School.prototype.parse_bb_staffdirectory=function(doc,url,resolve,reject,self) {
        var dir=self.staffdirectory;
        var inner_a=dir.querySelectorAll("a"),i,j;
        var domain=MTP.get_domain_only(url);
        var click_regex=/SearchButtonClick\(\'([^\']*)\',\s*([\d]*),\s*([\d]*),\s*([\d]*),\s*([\d]*)/,match;
        console.log("parse_bb_staffdirectory,url="+url);
        var promise_list=[],new_url,promise,url_begin,url_end;
        for(i=0;i<self.title_str.length;i++) {
            url_begin=self.url+"/site/default.aspx?PageType=2&PageModuleInstanceID="; //&ViewID=
            url_end="&RenderLoc=0&FlexDataID=0&Filter=JobTitle%3A"+encodeURIComponent(self.title_str[i]);
            for(j=0;j<inner_a.length;j++) {

                if((match=inner_a[j].outerHTML.match(click_regex))) {
                    new_url=url_begin+match[5]+"&ViewID="+match[1]+url_end;
                    promise=MTP.create_promise(new_url,self.parse_bb_staffdirectory_results,MTP.my_try_func,MTP.my_catch_func,self);
                    break;
                }
            }
            if(promise===undefined) { console.log(domain+": Could not find SearchButtonClick and create promise"); }
            promise_list.push(promise);
        }
        Promise.all(promise_list).then(function() { resolve(self); });

    };
    /* TODO: deal with area codes, otherwise done */
    School.prototype.parse_bb_staffdirectory_results=function(doc,url,resolve,reject,self) {
        console.log("parse_bb_staffdirectory_result,url="+url);
        var cs="",staff,i,curr_contact,footer=doc.querySelector(".gb-footer"),staffemail,match;
        if(doc.querySelector(".cs-staffdirectorydiv")) cs="cs-";
        staff=doc.querySelectorAll("."+cs+"staff");
        //console.log("doc.body.innerHTML="+doc.body.innerHTML);
        for(i=0;i<staff.length;i++) {
            curr_contact={name:staff[i].querySelector("."+cs+"staffname").innerText.trim(),
                         title:staff[i].querySelector("."+cs+"staffjob").dataset.value.trim(),
                          phone:staff[i].querySelector("."+cs+"staffphone").innerText.trim().replace(/\n/g,"").replace(/\s{2,}/g," ")
                         };
            if(curr_contact.phone.length>0 &&
               !phone_re.test(curr_contact.phone) && self.area_code.length>0) curr_contact.phone="("+self.area_code+") "+curr_contact.phone;
            else if(curr_contact.phone.length===0) curr_contact.phone=self.phone;
            staffemail=staff[i].querySelector(".staffemail script");
            if(staffemail&&(match=staffemail.innerHTML.match(/swrot13\(\'([^\']+)\'/))) {
                curr_contact.email=MTP.swrot13(match[1]);
            }
            //console.log("curr_contact="+JSON.stringify(curr_contact))
            if(self.matches_title_regex(curr_contact.title)) self.contact_list.push(curr_contact);
        }
        resolve(self);
    };
    /* Probably best to just grab all the pages for a school since we don't know what we want */
    School.prototype.parse_bb_minibase=function(doc,url,resolve,reject,self) {
        console.log("parse_bb_minibase,url="+url);
        self.page={}
        var minibase=self.minibase;
        var mod=minibase.parentNode,match,i,j,ModuleInstanceID=0,PageModuleInstanceID=0,ui_lbl,ui_dropdown;
        var detail=minibase.querySelector(".ui-widget-detail"),url_begin,url_end,new_url,field_num,ui_li,k;
        var filter="&FilterFields="+encodeURIComponent("comparetype:E:S;comparetype:E:S;"),promise;
        var flexitem=minibase.querySelectorAll(".sw-flex-item"),matched_school=false,matched_title=false;
        var promise_list=[];
        var fields=doc.querySelectorAll("[name^='Field']");
        var missing_field=-1;
        for(i=0;i<fields.length;i++) if((match=fields[i].id.match(/[\d]+$/)) && parseInt(match[0])>i && (missing_field=i)) break;
        if(match=mod.id.match(/[\d]+$/)) ModuleInstanceID=match[0];
        if(detail && (match=detail.id.match(/[\d]+$/))) PageModuleInstanceID=match[0];
        url_end="&DirectoryType=L&PageIndex=1";
        console.log("self.title_str="+self.title_str);
        for(k=0;k<self.title_str.length;k++) {
            filter="&FilterFields="+encodeURIComponent("comparetype:E:S;comparetype:E:S;");
            new_url=self.url+"/site/UserControls/Minibase/MinibaseListWrapper.aspx?ModuleInstanceID="+ModuleInstanceID;
            new_url=new_url+"&PageModuleInstanceID="+PageModuleInstanceID;
            for(i=0;i<flexitem.length;i++) {
                ui_lbl=flexitem[i].querySelector(".ui-lbl-inline");
                ui_dropdown=flexitem[i].querySelector("ul");
                if(!matched_school && /School|Location/i.test(ui_lbl.innerText) && ui_dropdown && (ui_li=ui_dropdown.querySelectorAll("li"))) {

                    field_num=ui_dropdown.id && ui_dropdown.id.match(/[\d]+$/) ? ui_dropdown.id.match(/[\d]+$/)[0] : i.toString();
                    for(j=0;j<ui_li.length;j++) {
                        if(self.matches_name(ui_li[j].innerText) && (matched_school=true) &&
                           (filter=filter+encodeURIComponent(field_num+":C:"+ui_li[j].innerText.trim()+";"))) break;
                    }
                }
                if(/Title|Position/i.test(ui_lbl.innerText) &&(matched_title=true)) filter=filter+encodeURIComponent((i).toString()+":C:"+self.title_str[k]+";");
            }
            /* If a field was missing and there was no title field, hopefully that was the title field */
            if(!matched_title && missing_field>=0) filter=filter+encodeURIComponent((missing_field).toString()+":C:"+self.title_str[k]+";");
            new_url=new_url+filter+url_end;
            console.log("new_url="+decodeURIComponent(new_url)+", title_str="+self.title_str[k]);
            self.page[self.title_str[k]]=1;

            promise=MTP.create_promise(new_url,self.parse_bb_minibase_results,MTP.my_try_func,MTP.my_catch_func,{self:self,title_str:self.title_str[k]});
            promise_list.push(promise);
        }
        Promise.all(promise_list).then(function() {
            resolve(self);
        });

    };
    School.prototype.parse_bb_minibase_results=function(doc,url,resolve,reject,extra) {
        var title_str=extra.title_str,self=extra.self;
        var page=self.page[title_str];
        var curr_contact,lst=doc.querySelectorAll(".sw-flex-item-list"),i,j,label,items,x;
        var term_map={"first":/First/i,"last":/Last/i,"title":/^(Position|Title)/i,"email":/^E(-)?mail/i,
                      "phone":/^(Phone|Tel)/i,"ext":/^(Ext)/i,"school":/School/i,"name":/Name/i};
        console.log("parse_bb_minibase_results,url="+url+", title_str="+title_str);
        for(i=0;i<lst.length;i++) {
            curr_contact={};
            items=lst[i].querySelectorAll(".sw-flex-item");
            for(j=0;j<items.length;j++) {
                label=items[j].querySelector(".sw-flex-item-label").innerText;
                for(x in term_map) if(term_map[x].test(label.trim())) curr_contact[x]=items[j].innerText.replace(label,"").trim();
            }
            if(curr_contact.first && curr_contact.last) curr_contact.name=curr_contact.first+" "+curr_contact.last;
            if(!curr_contact.phone || curr_contact.phone.length===0) curr_contact.phone=self.phone;
            if(curr_contact.phone && curr_contact.phone.length>0 &&
               curr_contact.ext && curr_contact.ext.length>0) curr_contact.phone=curr_contact.phone+" x"+curr_contact.ext;
            console.log("curr_contact="+JSON.stringify(curr_contact));
            if(curr_contact.title && self.matches_title_regex(curr_contact.title)) self.contact_list.push(curr_contact);
        }
        resolve(self);
       // console.log("flexlist="+flexlist.innerHTML);
    };

    School.prototype.parse_bb_swdirectory=function(doc,url,resolve,reject,self) {
        console.log("parse_bb_swdirectory,url="+url);
    };

    School.prototype.parse_schoolmessenger=function(doc,url,resolve,reject,self) {
        self.do_west_react(doc,url,resolve,reject,self);
    }

        /**
     * '''do_west_react''' does the react-based West Corporation queries
     * doc is the parsed document from the GM_xmlhttprequest response.responseText,
     * finalUrl is response.finalUrl from same query
     */
    School.prototype.do_west_react=function(doc,url,resolve,reject,self) {
        console.log("do_west_react,url="+url);
        var appendElement=document.body;
        self.westSearchTerm="";//self.query.title_str;
        url=url.replace(/^(https?:\/\/[^\/]+).*$/,"$1");
        //console.log("do_west_react,now url="+url)
        self.westBaseUrl=url;
        function increment_scripts() {
            ++self.loadedWestScripts;
            //console.log("Loaded "+(self.loadedWestScripts)+" out of "+self.totalWestScripts+" total scripts");
            if(self.loadedWestScripts===self.totalWestScripts) self.loadWestSettings(doc,url,resolve,reject,self);
        }

        var scripts=doc.scripts,i,div=document.createElement("div"),script_list=[],curr_script;
        self.portletInstanceId=doc.getElementsByClassName("staffDirectoryComponent")[0].dataset.portletInstanceId;
        if(appendElement!==undefined) appendElement.appendChild(doc.getElementsByClassName("staffDirectoryComponent")[0]);
        var good_scripts=doc.querySelectorAll("script[id*='ctl']"), head=document.getElementsByTagName("head")[0];
        self.totalWestScripts=good_scripts.length;
        self.loadedWestScripts=0;
        for(i=0; i<good_scripts.length; i++) {
            (curr_script=document.createElement("script")).src=good_scripts[i].src.replace(/^http:/,"https:");
            curr_script.onload=increment_scripts;
            script_list.push(curr_script);
            head.appendChild(curr_script);
        }
    };
    /* Loads the settings, namely the groupIds which is all we need */
    School.prototype.loadWestSettings=function(doc,url,resolve,reject,self) {
        console.log("loadWestSettings, url="+url);
        var json={"portletInstanceId":this.portletInstanceId};
        this.loadWestReact(doc,url,function(response) {
            var r_json=JSON.parse(response.responseText),i;
            self.westGroupIds=[];
            for(i=0; i < r_json.d.groups.length; i++) self.westGroupIds.push(r_json.d.groups[i].groupID);
            self.loadWestSearch(doc,url,resolve,reject,self);
        },reject,{type:"Settings",json:json,self:this});
    }
    /**
     * '''loadWestSearch''' loads the West Corporation style search query for the job title set by
     * my_query.job_title r loads the first 9999 alphabetically otherwise if my_query.job_title isn't set
     *
     * Letting json_response=JSON.parse(response.responseText), json_response.d.results should have a
     * list of objects of the results to the query, with
     * fields email, firstName, lastName,jobTitle,phone,website,imageURL,userID
     *
     *
     */
    School.prototype.loadWestSearch=function(doc,url,resolve,reject,self) {
        var json={"firstRecord":0,"groupIds":self.westGroupIds,"lastRecord":9999,
                 "portletInstanceId":self.portletInstanceId,
                 "searchTerm":self.westSearchTerm,"sortOrder":"LastName,FirstName ASC","searchByJobTitle":true};
        if(self.westSearchTerm===undefined) { json.searchTerm=""; json.searchByJobTitle=false; }
        self.loadWestReact(doc,url,resolve,reject,{type:"Search",json:json,self:self});
    };
    /**
     * '''loadWestReact''' does a GM_xmlhttprequest query of the StaffDirectory at the my_query.staff_path in question
     *
     * (my_query.staff_path to be found by searching e.g. Bing, and should be the part found by /https?:\/\/[^\/]+/
     * type is the type of query to get ("Settings" or "Search"), url is the what's the fucking word for beginning of path
     * url of the website
     * json is the json to send with it since it's a POST request
     * callback is the callback
     */
    School.prototype.loadWestReact=function(doc,old_url,resolve,reject,extra) {
        console.log("loadWestReact, url="+old_url+", type="+JSON.stringify(type)+", extra="+JSON.stringify(extra.json));
        var type=extra.type,json=extra.json,self=extra.self;
        var url=self.westBaseUrl+"/Common/controls/StaffDirectory/ws/StaffDirectoryWS.asmx/"+type;

        var headers={"Content-Type":"application/json;charset=UTF-8"};
        GM_xmlhttpRequest({method: 'POST', url: url, headers:headers, data:JSON.stringify(json),
            onload: function(response) {
                if(type==="Search") { self.parseWestSearch(response,resolve,reject,self); }
                else if(type==="Settings"||true) { resolve(response); }
            },
            onerror: function(response) { console.log("Fail"); },
            ontimeout: function(response) { console.log("Fail"); }
            });
    };
    /**
     * parse_west_search is called after the initial search query with the response,
     * searches to see if there are any private emails, then grabs them
     * with another loophole
     */
    School.prototype.parseWestSearch=function(response,resolve,reject,self) {
        var search=JSON.parse(response.responseText);
        var results=search.d.results,i,url,promise_list=[];
        Object.assign(self,{westResults:results,westPrivateCount:0,westPrivateDone:0});
        for(i=0; i < results.length; i++) {
            console.log("("+i+"), "+JSON.stringify(results[i]));
            if(results[i].email==="private") {
                self.westPrivateCount++;
                url=self.westBaseUrl+"/common/controls/General/Email/Default.aspx?action=staffDirectoryEmail&"+
                    "recipients="+results[i].userID;
                console.log("private email url="+url);
                if(results[i].jobTitle && self.matches_title_regex(results[i].jobTitle)) {
                    promise_list.push(MTP.create_promise(url,self.getWestPrivateEmail,MTP.my_try_func,MTP.my_catch_func,{i:i,self:self}));
                }
            }
           // else console.log("results["+i+"].email="+results[i].email);
//            console.log("Email for "+i+"="+results[i].email);
        }
        Promise.all(promise_list).then(function() {

            for(var i=0;i<self.westResults.length;i++) {
                let curr=self.westResults[i];
                self.contact_list.push({email:curr.email?curr.email:"",title:curr.jobTitle?curr.jobTitle:"",
                                        phone:curr.phone?curr.phone:"",name:curr.firstName && curr.lastName?curr.firstName+" "+curr.lastName:""});
            }
            console.log("Done with private emails");
            resolve(self);
        });
        //console.log("search="+text);
    };
    /**
     * getWestPrivateEmail uses another avenue to find the emails they tried to keep private
     * it resolves on the original callback to the West thing once all the private emails have been grabbed
     * probably a clunky way to do it but it's working and should be self contained
     */
    School.prototype.getWestPrivateEmail=function(doc,url,resolve,reject,extra) {
        var i=extra.i,self=extra.self;
        console.log("url="+url);
        var headers={"Content-Type":"application/json;charset=UTF-8"};
        self.westResults[i].email=doc.getElementById("ctl00_ContentPlaceHolder1_ctl00_txtTo").value;
        self.westPrivateDone++;
        console.log("Done "+self.westPrivateDone+" private emails");
        resolve(i);
    };
    School.prototype.init_SchoolSearch=function(doc,url,resolve,reject,self) {
        var curr_school,promise,parse_url;
        self.base=url.replace(/\/$/,"")
        self.url=url.replace(/(https?:\/\/[^\/]*).*$/,"$1");

        self.resolve=resolve;self.reject=reject;
        self.page_type=self.id_page_type(doc,url,resolve,reject,self);
        if(Schools.page_map[self.page_type]!==undefined) self.page_type=Schools.page_map[self.page_type];
       // Schools.curr_school=Schools[Schools.page_type];

        /*console.log("School.prototype.init_SchoolSearch, url="+url+", query="+JSON.stringify(self.query));
        console.log("page_type="+self.page_type);*/
        console.log("|"+self.query.name+"|"+url+"|"+self.query.street+"|"+self.query.city+"|"+self.query.state+"|"+self.page_type);
        //return;
        /* Base is the base page for a school if we're in a district/system page */
        if((curr_school=self[self.page_type])&&curr_school.find_base&&self.type==="school") {
            console.log("searching for base "+JSON.stringify(Schools[self.page_type]));
            self.base=curr_school.find_base(doc,url+(curr_school.base_suffix?curr_school.base_suffix:""),resolve,reject,self).replace(/\/$/,""); }
        console.log("self.base="+self.base);

        /* if suffix we can immediately head to the directory parser */
        if(curr_school && curr_school.suffix) {
            console.log("# heading immediately to directory");
            self.call_parser({url:self.base+curr_school.suffix,self:self}); }
        else if(curr_school && curr_school.find_directory) {
            console.log(self.name+": Finding directory");
            promise=MTP.create_promise(self.base,curr_school.find_directory,self.call_parser,MTP.my_catch_func,self);
        }
        else if(!curr_school) {
            console.log("School page_type not defined parsing yet, trying parse_none");
            self.parse_none(doc,url,resolve,reject,self);
        }
        else { console.log("Weird shouldn't be here");
              for(var x in curr_school) {
                  console.log("curr_school["+x+"]="+curr_school[x]); }


             }
    };

        /**Schools.id_page_type identifies the CMS/etc for the school website */
    School.prototype.id_page_type=function(doc,url,resolve,reject,self) {
        var page_type="none",i,j,match,copyright,sites_google_found=false,generator="",gen_content,gen_list=doc.querySelectorAll("meta[name='generator' i]");
        var page_type_regex2=/Apptegy/,copyright_regex=/Blackboard, Inc/,page_type_regex=new RegExp(Schools.page_regex_str,"i");
        for(i=0; i < gen_list.length; i++) {
            if(gen_list[i].content) { generator+=(generator.length>0?";":"")+gen_list[i].content.replace(/ - [^;]*/g,""); }
        }
            //console.log("generator="+(generator[i].content));
        var lst=[doc.links,doc.querySelectorAll("link")];
        for(j=0;j<lst.length;j++) {
            for(i=0; i < lst[j].length; i++) {
                lst[j][i].href=MTP.fix_remote_url(lst[j][i].href,url);

                if((match=lst[j][i].href.match(page_type_regex)) || (match=lst[j][i].innerText.match(page_type_regex2))) {
                    page_type=match[0].replace(/\.[^\.]*$/,"").toLowerCase().replace(/www\./,"").replace(/\./g,"_").replace(/^\/\//,"");
                    break; }
                else if(/sites\.google\.com/.test(lst[j][i].href) && /Google Sites/i.test(lst[j][i].innerText)) sites_google_found=true;
                else if(generator.length===0 && MTP.get_domain_only(url,true)===MTP.get_domain_only(lst[j][i].href,true) &&
                        /\/wp-content|wp\//.test(lst[j][i].href)) generator="WordPress";
                else if(/\/CMSScripts\//.test(lst[j][i].href)) generator="Kentico";
            }
        }
        doc.querySelectorAll("footer").forEach(function(footer) {
            if(footer.dataset.createSiteUrl&&/sites\.google\.com/.test(footer.dataset.createSiteUrl)) sites_google_found=true; });
        if(page_type==="none" && doc.getElementById("sw-footer-copyright")) page_type="blackboard";
        else if(page_type==="none"&& sites_google_found) page_type="sites_google";
        if(page_type==="none") {
            doc.querySelectorAll("script").forEach(function(curr_script) {
                for(i=0; i < Schools.script_regex_lst.length;i++) {
                    if(curr_script.src&&Schools.script_regex_lst[i].regex.test(curr_script.src)) page_type=Schools.script_regex_lst[i].name;
                    //  else if(curr_script.innerHTML.indexOf("_W.configDomain = \"www.weebly.com\"")!==-1) console.log("generator=weebly.com");
                }
            });
        }
        if(page_type==="none" && generator.length>0) return self.fix_generator(generator);
        return page_type;
    };

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
        var query={type:"district",name:my_query.short_name,
                   title_regex:/Superintendent|Administrator|CTO|Technology|IT |Information|Communications|PR|Public Relations/,
                   state_dir:false,city:my_query.city,state:my_query.state};
        my_query.url=result;
        var promise=MTP.create_promise(my_query.url,Schools.init_SchoolSearch,parse_school_then,MTP.my_catch_func,query);
    }
    function parse_school_then(result) {
        console.log("result="+JSON.stringify(result));
    }

    function begin_script(timeout,total_time,callback) {
        if(timeout===undefined) timeout=200;
        if(total_time===undefined) total_time=0; 
        if(callback===undefined) callback=init_Query;
        if(MTurk!==undefined) {

                callback();
        }
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
        for(x in my_query.fields) if(field=document.getElementById(x)) field.value=my_query.fields[x];
    }

    function submit_if_done() {
        var is_done=true,x;
        add_to_sheet();
        for(x in my_query.done) if(!my_query.done[x]) is_done=false;
        if(is_done && !my_query.submitted && (my_query.submitted=true)) MTurk.check_and_submit();
    }
    function paste_data(e) {
        e.preventDefault();
        var target_type=e.target.id.replace(/1$/,"");
        var term_list=["","Tech Coordinator","Superintendent"];
        var text = e.clipboardData.getData("text/plain");
        var ret=Gov.parse_data_func(text),fullname;
        console.log("ret="+JSON.stringify(ret));
        var term_map={"title":"1","first":"2","last":"3",phone:"4",email:"5"},x;
        if(ret) {
            if(ret.name) {
                fullname=MTP.parse_name(ret.name);
                ret.first=fullname.fname;
                ret.last=fullname.lname;
            }
            if(ret.phone) ret.phone=ret.phone.replace(/^([\d]{3}\))/,"($1");
            if(ret.email) ret.email=ret.email.replace(/^20/,"");
            if(ret.title===undefined||ret.title.length===0)  {
                let num=target_type.replace(/^f/,"").replace(/^$/,"0");
                console.log("target_Type="+num+", elem="+parseInt(num));
                ret.title=term_list[parseInt(num)];
            }
            for(x in term_map) {
                if(ret[x]!==undefined) document.getElementById(target_type+term_map[x]).value=ret[x];
            }
        }
        else e.target.value=text;
    }
    function paste_name(e) {
        e.preventDefault();
        var target_type=e.target.id.replace(/2$/,"");
        var text = e.clipboardData.getData("text/plain");
        var ret=MTP.parse_name(text.trim());
        var term_map={"fname":"2","lname":"3"},x;
        if(ret&&ret.fname) {

            for(x in term_map) {
                if(ret[x]!==undefined) {
                    my_query.fields[target_type+term_map[x]]=ret[x];
                    document.getElementById(target_type+term_map[x]).value=ret[x];
                }
            }
        }
        else e.target.value=text;
    }


    function init_Query()
    {
        console.log("in init_query");
        var i;
        var ctrl=document.querySelectorAll(".form-control");
        ctrl.forEach(function(elem) { elem.value="na"; });
        var wT=document.getElementById("DataCollection").getElementsByTagName("table")[0];
        var dont=document.getElementsByClassName("dont-break-out");
        my_query={name:wT.rows[0].cells[1].innerText,city:wT.rows[1].cells[1].innerText,county:wT.rows[2].cells[1].innerText,
                  state:wT.rows[3].cells[1].innerText,
                  fields:{"f1":"",f2:"",f3:"",f4:"",f5:"",f11:"",f12:"",f13:"",f14:"",f15:"",f21:"",f22:"",f23:"",f24:"",f25:""},
                  done:{},submitted:false};
        my_query.short_name=my_query.name.replace(/,.*$/,"").trim();
	console.log("my_query="+JSON.stringify(my_query));
        for(i in my_query.fields) my_query.fields[i]="na";
        var search_str=my_query.name+" "+reverse_state_map[my_query.state];
        var title_lst=["","1","2"];
        for(i=0;i<title_lst.length;i++) {
            document.querySelector("#f"+title_lst[i]+"1").addEventListener("paste",paste_data);
            document.querySelector("#f"+title_lst[i]+"2").addEventListener("paste",paste_name);
        }

        var promise=new Promise((resolve,reject) => {
            var s=new School({name:my_query.short_name,city:my_query.city,state:my_query.state,type:"district",
                              title_str:["Technology","Superintendent","Comm"],
                              debug:true,
                             title_regex:[/Superintendent/i,/(^|[^A-Za-z]+)(Technology|CTO|IT|Network)($|[^A-Za-z]+)/i,/Communication|Community/i,
                                          /(^|[^A-Za-z]+)PR($|[^A-Za-z]+)/i,/Information/i]},resolve,reject);

        });
        promise.then(function(self) {
            var i,curr,fullname;
            var result=self.contact_list;
            console.log("result="+JSON.stringify(result));
            for(i=0;i<result.length;i++) {
                curr=result[i];
                if(!curr.name) continue;
                if(!curr.phone) curr.phone="na";
                for(let x in curr) if(curr[x].length===0) curr[x]="na";
                if(/^((Interim )?Superintendent( of Schools)?$)/i.test(curr.title)||(/Superintendent|Director of Schools|District Administrator/.test(curr.title) && my_query.fields.f21==="na")) {
                    my_query.fields.f21=curr.title;
                    fullname=MTP.parse_name(curr.name);
                    my_query.fields.f22=fullname.fname;
                    my_query.fields.f23=fullname.lname;
                    my_query.fields.f24=curr.phone;
                    if(curr.email) my_query.fields.f25=curr.email;
                }
                if(/Technology|CTO|IT/.test(curr.title) && (/Director|CTO|Chief|Coordinator/.test(curr.title) || my_query.fields.f11==="na")) {
                     my_query.fields.f11=curr.title;
                    fullname=MTP.parse_name(curr.name);
                    my_query.fields.f12=fullname.fname;
                    my_query.fields.f13=fullname.lname;
                    my_query.fields.f14=curr.phone;
                    if(curr.email) my_query.fields.f15=curr.email;
                }
                if(!/Teacher$/.test(curr.title) &&
                   /Communication|(PR($|[^A-Za-z]+))|Information|Community/i.test(curr.title) && !/Information Technology/i.test(curr.title) && (/Director|Coordinator|Officer/i.test(curr.title) || my_query.fields.f1==="na")) {
                     my_query.fields.f1=curr.title;
                    fullname=MTP.parse_name(curr.name);
                    my_query.fields.f2=fullname.fname;
                    my_query.fields.f3=fullname.lname;
                    my_query.fields.f4=curr.phone;
                    if(curr.email) my_query.fields.f5=curr.email;
                }
            }
            add_to_sheet();

            console.log("result="+JSON.stringify(result)); });

       /* const queryPromise = new Promise((resolve, reject) => {
            console.log("Beginning URL search");
            query_search(search_str, resolve, reject, query_response,"query");
        });
        queryPromise.then(query_promise_then)
            .catch(function(val) {
            console.log("Failed at this queryPromise " + val); GM_setValue("returnHit",true); });*/
    }

})();