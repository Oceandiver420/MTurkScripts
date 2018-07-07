// ==UserScript==
// @name         Panza
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  New script
// @author       You
// @include        http://*.mturkcontent.com/*
// @include        https://*.mturkcontent.com/*
// @include        http://*.amazonaws.com/*
// @include        https://*.amazonaws.com/*
// @include https://worker.mturk.com/*
// @include https://*.reddit.com/*
// @grant  GM_getValue
// @grant GM_setValue
// @grant GM_addValueChangeListener
// @grant        GM_setClipboard
// @grant GM_xmlhttpRequest
// @grant GM_openInTab
// @connect google.com
// @connect bing.com
// @connect yellowpages.com
// @connect *
// @connect crunchbase.com
// @require https://raw.githubusercontent.com/hassansin/parse-address/master/parse-address.min.js
// @require https://raw.githubusercontent.com/jacobmas/MTurkScripts/master/jacobsscriptfuncs.js
// ==/UserScript==


// VCF Do something with?
(function() {
    'use strict';

    var automate=false;
    var email_re = /(([^<>()\[\]\\.,;:\s@"：+=\/\?%]+(\.[^<>()\[\]\\.,;:：\s@"\?]+)*)|("[^\?]+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g;

    var phone_re=/[\+]?[(]?[0-9]{3}[)]?[-\s\.\/]+[0-9]{3}[-\s\.\/]+[0-9]{4,6}/im;
    var fax_re=/Fax[:]?[\s]?([\+]?[(]?[0-9]{3}[)]?[-\s\.\/]+[0-9]{3}[-\s\.\/]+[0-9]{4,6})/im;


    var personal_email_domains=["aol.com","bigpond.com","frontiernet.net","gmail.com","icloud.com","mchsi.com","me.com","pacbell.net","rogers.com","rr.com","ymail.com"];
    var my_query = {};
    var email_list=[];
    var sch_name="School District Name", sch_domain="Domain of school district";
    var bad_urls=[];
    var country_domains=[".ar",".at",".au",".br",".ch",".cn",".de",".eu",".fr",".it",".jp",".ro",".ru",".se",".tw",".uk",".uy",".vn",".pt"];
    var first_try=true;

    function check_function()
    {
        return true;
    }
	

    function query_response(response,resolve,reject) {
        var doc = new DOMParser()
        .parseFromString(response.responseText, "text/html");
        console.log("in query_response\n"+response.finalUrl);
        var search, b_algo, i=0, inner_a;
	var b_url="crunchbase.com", b_name, b_factrow, b_caption;
        var b1_success=false, b_header_search;
        try
        {
            search=doc.getElementById("b_content");
            b_algo=search.getElementsByClassName("b_algo");

            console.log("b_algo.length="+b_algo.length);
            if(b_algo.length===0)
            {
                console.log("b_algo length=0");
                GM_setValue("returnHit",true);
                return;
            }
           
            for(i=0; i < b_algo.length; i++)
            {
                b_name=b_algo[i].getElementsByTagName("a")[0].textContent;
                b_url=b_algo[i].getElementsByTagName("a")[0].href;


                if(!is_bad_url(b_url, bad_urls))
                {
                    document.getElementById("webpage_url").value=b_url;
                    check_and_submit(check_function, automate);
                    return;

                }
                
            }
            return;
           /* if(!found_url)
            {
                document.getElementById("UrlBad").checked=true;
                check_and_submit();
                b1_success=true;
                return;
            }*/

          //GM_setValue("returnHit",true);
            //return;

        }
        catch(error)
        {
	    console.log("Error "+error);
	    GM_setValue("returnHit",true);
            return;
            
            //reject(JSON.stringify({error: true, errorText: error}));
        }
        GM_setValue("returnHit",true);
        return;

    }
    function check_and_submit2(check_function,automate2)
    {
        console.log("in check");
        if(!check_function())
        {
            GM_setValue("returnHit",true);
            console.log("bad");
            return;
        }
        console.log("Checking and submitting");


        if(automate2)
        {
            setTimeout(function() { document.getElementById("submitButton").click(); }, 0);
        }
    }

    function query_search(resolve,reject) {
        var search_str=my_query.name+" ";

        console.log("Searching with bing for "+search_str);
        var search_URIBing='https://www.bing.com/search?q='+encodeURIComponent(search_str)+"&first=1&rdr=1";
        var domain_URL='https://www.google.com/search?q='+encodeURIComponent(search_str);//+" company");
        GM_xmlhttpRequest({
            method: 'GET',
            url:    search_URIBing,

            onload: function(response) {
             //   console.log("On load in crunch_response");
            //    crunch_response(response, resolve, reject);
             query_response(response, resolve, reject);
            },
            onerror: function(response) { reject("Fail"); },
            ontimeout: function(response) { reject("Fail"); }


            });
    }



    function parse_reddit()
    {
        var i,j;
        var review_obj={};
        var review_pos=1;
        var last_HR=false;
        var the_title=document.getElementsByClassName("s134yi85-0")[0].innerText;
        var comments=document.getElementsByClassName("Comment");

       // var pre_review_elem=comments[0].getElementsByClassName("r4x9ih-3")[0];
        var full_review=comments[0].getElementsByClassName("r4x9ih-6")[0];
        var paras=full_review.childNodes;//getElementsByClassName("s570a4-10");
        var curr_title="";
        var curr_text="";
        var curr_rating="";
        var rating_re=/([^€\d]|^)([\d\.]+)\/([\d\.]+)/;
        var rating_re2=/((Score)|(Rating))\s*[:\-]\s*(\d+)/;
        var blank_shit=/^\s*$/;
        var rating_match, rating_match2;
        var in_reviews=false;
        var starting_new=true,starting_new_HR=false;



        var full_review2=full_review.cloneNode(true);
        paras=full_review2.childNodes;


        /* Replace UL parts with <p> */
       // var paras2=full_review2.childNodes;
        for(i=0; i < paras.length; i++)
        {

            console.log("Help: i="+i);
              if(paras[i].tagName==="UL")
            {
                var list_nodes=paras[i].childNodes;
                for(j=0; j < list_nodes.length; j++)
                {
                    var new_node=document.createElement("p");
                    new_node.innerHTML=list_nodes[j].innerHTML;
                    full_review2.insertBefore(new_node, paras[i].nextSibling);
                    //paras[i].removeChild(list_nodes[j]);
                }
                full_review2.removeChild(paras[i]);
            }
        }
        paras=full_review.childNodes;
        console.log("full_review2.innerText="+full_review2.innerHTML);

        for(i=0; i < paras.length; i++)
        {


            if((paras[i].getElementsByTagName("h4")!==undefined && paras[i].getElementsByTagName("h4").length>0) ||
              (paras[i].getElementsByTagName("strong")!==undefined && paras[i].getElementsByTagName("strong").length>0) || (paras[i].tagName==="H4")
               || (paras[i].tagName==="H3") 
              )
            {
                console.log("Enteringreviews");
                in_reviews=true;
            }
            console.log("paras["+i+"]="+paras[i].innerText+"\nparas[i].tagName="+paras[i].tagName+", starting_new="+starting_new+", in_reviews="+in_reviews);

            if(in_reviews && paras[i].tagName==="HR")
            {
                last_HR=true;
                console.log("\n\nfound HR\n\n");
                if(!(curr_title.length===0 && curr_rating.length===0 && curr_text.length===0))
                {
                    review_obj["WhiskeyName"+review_pos]=curr_title;
                    review_obj["Rating"+review_pos]=curr_rating;
                    review_obj["ReviewText"+review_pos]=curr_text;

                    /* Last one */
                    starting_new=true;
                    starting_new_HR=true;
                    //review_pos=review_pos+1;
                    curr_title="";
                    curr_text="";
                    curr_rating="";
                }
                else
                {
                    starting_new=true;
                    starting_new_HR=true;
                }
            }
            else if(blank_shit.test(paras[i].innerText))
            {
                console.log("blank shit");
            }
            else if(in_reviews && (rating_re.test(paras[i].innerText) || rating_re2.test(paras[i].innerText)))
            {
                rating_match=paras[i].innerText.match(rating_re);
                rating_match2=paras[i].innerText.match(rating_re2);
                console.log("Doing ratings, rating_match="+JSON.stringify(rating_match));
                if(rating_match===null && rating_match2 !==null)
                {
                    curr_rating=rating_match2[4];
                }
                else if(parseInt(rating_match[3])===100)
                {
                    curr_rating=rating_match[2];
                    console.log("curr_rating="+curr_rating);
                }
                else if(rating_match[3]==="10")
                {
                    curr_rating=parseFloat(rating_match[2])*10;
                                        console.log("curr_rating="+curr_rating);

                }

                if(!(curr_title.length===0 && curr_rating.length===0 && curr_text.length===0))
                {
                    review_obj["WhiskeyName"+review_pos]=curr_title;
                    review_obj["Rating"+review_pos]=curr_rating;
                    review_obj["ReviewText"+review_pos]=curr_text;


                    /* Last one */
                    starting_new=true;
                    starting_new_HR=false;
                    review_pos=review_pos+1;
                    console.log("\treview_pos="+review_pos);

                    curr_title="";
                    curr_text="";
                    curr_rating="";
                }
                else
                {
                    starting_new=true;
                    starting_new_HR=false;
                }
            }
            else if(in_reviews && starting_new &&
                    ( (paras[i].getElementsByTagName("h4")!==undefined && paras[i].getElementsByTagName("h4").length>0) ||
              (paras[i].getElementsByTagName("strong")!==undefined && paras[i].getElementsByTagName("strong").length>0) ||
                     (paras[i].tagName==="H4") || paras[i].tagName==="H3" || paras[i].tagName==="A" 
                     
              ))
            {
                console.log("help");
                console.log("Adding title");
                if(paras[i].getElementsByTagName("strong")!==undefined && paras[i].getElementsByTagName("strong").length>0)
                {
                    curr_title=paras[i].getElementsByTagName("strong")[0].innerText;
                }
                else
                {
                    curr_title=paras[i].innerText;
                }

                curr_title=curr_title.replace(/([^\$\,:\-\"–\(]*)[\$\,:\-\"–\(].*/,"$1").replace(/\s[\d]+%/,"").trim();
                if(curr_title.indexOf("Review")===0 && paras[i].innerText.indexOf(":")!==-1)
                {
                    curr_title=paras[i].innerText.split(":")[1].replace(/([^\$\,:\-\"–\(]*)[\$\,:\-\"–\(].*/,"$1").replace(/\s[\d]+%/,"").trim();
                }
                starting_new=false;
                starting_new_HR=false;
            }

            else if(in_reviews)
            {
                curr_text=curr_text+paras[i].innerText+"\n";
            }
        }
        console.log("review_obj="+JSON.stringify(review_obj));
        GM_setValue("review_obj",JSON.stringify(review_obj));



    }






    function init_Query()
    {

       //var wT=document.getElementById("workContent").getElementsByTagName("table")[0];
        var mForm=document.getElementById("mturk_form");
        var inner_a=mForm.getElementsByTagName("a")[4];
        console.log("inner_a.innerText="+inner_a.innerText);
        my_query={url: inner_a.href};

        my_query.url=my_query.url.replace(/\/[a-z][a-z]\.reddit\.com/,"/www.reddit.com")
         console.log("my_query.url="+my_query.url);
        GM_setValue("review_obj","");
        GM_setValue("url", my_query.url+"?sort=old");

        /* TODO: add listener */

       GM_addValueChangeListener("review_obj", function() {
           var review_obj=JSON.parse(GM_getValue("review_obj"));
           //console.log("review_obj="+JSON.stringify(review_obj));
           var x;
           var ct_stuff=0;
           for(x in review_obj)
           {
               ct_stuff=ct_stuff+1;
               if(review_obj[x].length===0)
               {
                   console.log("Bad attempt, returning");
                   GM_setValue("returnHit",true);
                   return;
               }
               console.log("x="+x);
               document.getElementsByName(x)[0].value=review_obj[x];
           }
           if(ct_stuff>0)
           {
               console.log("Checking and submitting");
               check_and_submit2(check_function,automate);
           }
           else
           {
               GM_setValue("returnHit",true);
               return;
           }
       });



    }

    /* Failsafe to stop it  */
    window.addEventListener("keydown",function(e) {
        if(e.key !== "F1") {
            return;
        }
        GM_setValue("stop",true);
     });


    if (window.location.href.indexOf("mturkcontent.com") != -1 || window.location.href.indexOf("amazonaws.com") != -1)
    {
        var submitButton=document.getElementById("submitButton");
        if(!submitButton.disabled )
        {

            init_Query();
        }

    }
    else if(window.location.href.indexOf("reddit.com")!==-1)
    {
        /* Do reddit */
        GM_setValue("url","");
        GM_addValueChangeListener("url",function() {
            window.location.href=GM_getValue("url"); });
        /* Start parsing review */
        parse_reddit();
    }
    else
    {
	/* Should be MTurk itself */
       
        if(automate)
        {
            setTimeout(function() { btns_secondary[0].click(); }, 20000); }
        GM_setValue("returnHit",false);
       GM_addValueChangeListener("returnHit", function() {
                if(GM_getValue("returnHit")!==undefined && GM_getValue("returnHit")===true &&
                  btns_secondary!==undefined && btns_secondary.length>0 && btns_secondary[0].innerText==="Return"
                  )
                {
                    if(automate) {
                        setTimeout(function() { btns_secondary[0].click(); }, 0); }
                }
            });
         /* Regular window at mturk */
        var btns_primary=document.getElementsByClassName("btn-primary");
        var btns_secondary=document.getElementsByClassName("btn-secondary");
        if(GM_getValue("stop") !== undefined && GM_getValue("stop") === true)
        {
        }
        else if(btns_secondary!==undefined && btns_secondary.length>0 && btns_secondary[0].innerText==="Skip" &&
               btns_primary!==undefined && btns_primary.length>0 && btns_primary[0].innerText==="Accept")
        {

            /* Accept the HIT */
            if(automate) {
                btns_primary[0].click(); }
        }
        else
        {
            /* Wait to return the hit */
            console.log("MOO");
            var cboxdiv=document.getElementsByClassName("checkbox");
            var cbox=cboxdiv[0].firstChild.firstChild;
            if(cbox.checked===false) cbox.click();
        }

    }


})();