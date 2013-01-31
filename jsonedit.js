jQuery.fn.extend({
    // Quick little context menu based on
    // https://github.com/joewalnes/jquery-simple-context-menu
    jsonMenu: function(cfg) {
        var config = {
            title: '',
            items: []
        };
        $.extend(config, cfg);

        function create(e) {
            var menu = $('<ul class="jsonmenu"></ul>').appendTo(document.body);
            if (config.title) {
                $('<li class="jsonmenutitle"></li>').text(config.title).appendTo(menu);
            }
            config.items.forEach(function(item) {
                if (item) {
                    var row = $('<li><a href="#"><span></span></a></li>').appendTo(menu);
                    row.find('span').text(item.label);
                    if (item.action) {
                        row.find('a').click(function() { item.action(e); });
                    }
                } else {
                    $('<li class="jsonmenusep"></li>').appendTo(menu);
                }
            });
            return menu;
        }

        this.bind('contextmenu', function(e) {
            var menu = create(e).show();

            var left = e.pageX+5, top = e.pageY;
            if (top + menu.height() >= $(window).height()) {
                top -= menu.height();
            }
            if (left + menu.width() >= $(window).width()) {
                left -= menu.width();
            }

            menu.css({zIndex:1000001, left:left, top:top})
                .bind('contextmenu', function() {return false;});

            var bg = $('<div></div>')
                .css({left:0, top:0, width:'100%', height:'100%', position:'absolute', zIndex:1000000})
                .appendTo(document.body)
                .bind('contextmenu click', function() {
                    bg.remove();
                    menu.remove();
                    return false;
                });

            menu.find('a').click(function() {
                bg.remove(); menu.remove();
            });

            return false;
        });
        return this;
    },
    jsonEdit: function(obj, cfg) {
        var config = {
            hide: '[_]',
            show: '[+]',
            changed: null,
            classname: null
        };
        $.extend(config, cfg);
        var editing = null;

        function builder(target, path, obj) {
            var arr, cls, i=0, p=path.join('_');

            var table = $('<table class="jsonedit"><thead><tr><th colspan="2"><span class="jsonctl"><a href="#" action="hide">'+config.hide+'</a></span></th></tr></thead></table>').appendTo(target);
            if ($.isArray(obj)) {
                arr = true; cls = 'list';
            } else if ($.isPlainObject(obj)) {
                arr = false; cls = obj[config.classname] || 'mapping';
            }
            $('<span></span>').text(cls).insertAfter(table.find('span'));
            var tbody = $('<tbody/>').appendTo(table);
            $.each(obj, function(k, v) {
                if (k == config.classname) return;
                var key = arr ? '['+k+']' : k;
                var fp = path.concat(k).join('.');
                var row = $('<tr/>').addClass(++i&1?'odd':'even').attr('fp', fp).appendTo(tbody);
                $('<td/>').addClass(arr?'jsonidx':'jsonkey').text(key).appendTo(row);
                var val = $('<td/>').appendTo(row);
                if ($.isArray(v) || $.isPlainObject(v)) {
                    builder(val, path.concat(k), v);
                } else {
                    val.addClass('jsonval').text(JSON.stringify(v));
                }
            });
        }

        function change_val(el) {
            var chg = obj;
            var path = $(el).parent('tr').attr('fp').split('.');
            var v = $(el).text();
            try {
                v = JSON.parse(v);
            } catch(e) { /* ignore */ }
            for(var i=0; i<path.length-1; i++)
                chg = chg[path[i]];
            chg[path[i]] = v;

            if ($.isArray(v) || $.isPlainObject(v)) {
                $('.jsonkey,.jsonval,.jsonctl>a').unbind();
                $(el).removeClass('jsonval').empty();
                builder(el, path, v);
                bindevents();
            } else {
                $(el).text(JSON.stringify(v));
            }
        }

        function rename_key(el) {
            var chg = obj;
            var path = $(el).parent('tr').attr('fp').split('.');
            var k = $(el).text();
            for(var i=0; i<path.length-1; i++)
                chg = chg[path[i]];
            if (chg[k] == undefined) {
                var v = chg[path[i]];
                chg[k] = v;
                delete(chg[path[i]]);
                $(el).parent('tr').attr('fp', path.slice(0, -1).concat(k).join('.')).attr('orig', null);
            } else {
                k = path.slice(0, -1).concat(k).join('.');
                $(el).text(path[i]).attr('orig', null);
                window.alert('The object already has a field named "'+k+'"');
            }
        }

        function insert_key(el) {
            var chg = obj;
            var path = $(el).parent('tr').attr('fp').split('.');
            var i, k = 'newkey';
            for(i=0; i<path.length-1; i++)
                chg = chg[path[i]];
            if (chg[k] == undefined) {
                chg[k] = null;
                var row = $('<tr>').attr('fp', path.slice(0, -1).concat(k).join('.')).insertAfter($(el).parent('tr'));
                $('<td/>').addClass('jsonkey').text(k).appendTo(row);
                $('<td/>').addClass('jsonval').text('null').appendTo(row);
                row.parent().children().each(function(i, s) {
                    $(s).removeClass('even').removeClass('odd').addClass(++i&1?'odd':'even');
                });
                $('.jsonkey,.jsonval,.jsonctl>a').unbind();
                bindevents();
            } else {
                k = path.slice(0, -1).concat(k).join('.');
                window.alert('The object already has a field named "'+k+'"');
            }
        }

        function delete_key(el) {
            var chg = obj;
            var path = $(el).parent('tr').attr('fp').split('.');
            for(var i=0; i<path.length-1; i++)
                chg = chg[path[i]];
            delete(chg[path[i]]);
            var row = $(el).parent('tr');
            var tbody = row.parent();
            row.remove();
            tbody.children().each(function(i, s) {
                $(s).removeClass('even').removeClass('odd').addClass(++i&1?'odd':'even');
            });
        }

        function edit_done(el) {
            $(el).attr('contentEditable', false).attr('orig', null)
                                .unbind('focusout').unbind('keypress');
            editing = null;
            if ($(el).hasClass('jsonkey')) {
                rename_key(el);
            } else {
                change_val(el);
            }
        }

        function bindevents() {
            $('.jsonkey,.jsonval').dblclick(function(evt) {
                evt.preventDefault();
                var el=evt.toElement, orig=$(el).text();
                editing = el;
                $(el).attr('orig', orig)
                     .attr('contentEditable', true)
                     .focusout(function(e) {
                         edit_done(el);
                }).keypress(function(k) {
                    if (k.keyCode == 13) {
                        k.preventDefault();
                        edit_done(el);
                    }
                }).focus().select();
            });
            $('.jsonctl>a').click(function(evt) {
                var el = evt.toElement;
                var action = $(el).attr('action');
                if (action == 'hide') {
                    $(el).parentsUntil('table').siblings('tbody').hide();
                    $(el).attr('action', 'show').html(config.show);
                } else if (action == 'show') {
                    $(el).parentsUntil('table').siblings('tbody').show();
                    $(el).attr('action', 'hide').html(config.hide);
                }
            });
            $('.jsonkey').jsonMenu({
                title: 'JSON Mapping',
                items: [
                    {label: "Insert", action: function(e) { insert_key(e.toElement); } },
                    {label: "Delete", action: function(e) { delete_key(e.toElement); } }
                ]
            });
        }

        $(document.body).keyup(function(k) {
            if (editing && k.keyCode == 27) {
                var orig = $(editing).attr('orig');
                $(editing).text(orig).attr('orig', null).attr('contentEditable', false);
            }
        });

        builder(this, [], obj);
        bindevents();
        return this;
    }
});
// vim: ts=4 sts=4 sw=4 expandtab:
