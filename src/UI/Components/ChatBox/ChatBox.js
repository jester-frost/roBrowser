/**
 * UI/Components/ChatBox/ChatBox.js
 *
 * Dialog windows
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	"use strict";


	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var jQuery             = require('Utils/jquery');
	var Renderer           = require('Renderer/Renderer');
	var KEYS               = require('Controls/KeyEventHandler');
	var Client             = require('Core/Client');
	var Session            = require('Engine/SessionStorage');
	var PACKET             = require('Network/PacketStructure');
	var Network            = require('Network/NetworkManager');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./ChatBox.html');
	var cssText            = require('text!./ChatBox.css');
	var ProcessCommand     = require('Controls/ProcessCommand');


	/**
	 * Constants
	 */
	var MAX_MSG       = 50;
	var MAX_HISTORY   = 50;
	

	/**
	 * Create Basic Info component
	 */
	var ChatBox = new UIComponent( 'ChatBox', htmlText, cssText );


	/**
	 * Constants
	 */
	ChatBox.TYPE = {
		SELF:     1 << 0,
		PUBLIC:   1 << 1,
		PRIVATE:  1 << 2,
		PARTY:    1 << 3,
		GUILD:    1 << 4,
		ANNOUNCE: 1 << 5,
		ERROR:    1 << 6,
		INFO:     1 << 7,
		BLUE:     1 << 8, // TODO: find a better name
	};


	/**
	 * Initialize UI
	 */
	ChatBox.init = function Init()
	{
		this.history = [];
		this.historyIndex = 0;

		this.ui.css('top', (Renderer.height - ( this.ui.find('.content').height() + 53 )) + 'px');
		this.draggable( this.ui.find('.input') );

		// Setting chatbox scrollbar
		Client.loadFiles([DB.INTERFACE_PATH + "basic_interface/dialscr_down.bmp", DB.INTERFACE_PATH + "basic_interface/dialscr_up.bmp"], function( down, up ){
			jQuery("style:first").append([
				"#chatbox .content::-webkit-scrollbar { width: 10px; height: 10px;}",
				"#chatbox .content::-webkit-scrollbar-button:vertical:start:increment,",
				"#chatbox .content::-webkit-scrollbar-button:vertical:end:decrement { display: none;}",
				"#chatbox .content::-webkit-scrollbar-corner:vertical { display:none;}",
				"#chatbox .content::-webkit-scrollbar-resizer:vertical { display:none;}",
				"#chatbox .content::-webkit-scrollbar-button:start:decrement,",
				"#chatbox .content::-webkit-scrollbar-button:end:increment { display: block; border:none;}",
				"#chatbox .content::-webkit-scrollbar-button:vertical:increment { background: url('"+ down +"') no-repeat; height:10px;}",
				"#chatbox .content::-webkit-scrollbar-button:vertical:decrement { background: url('"+ up +"') no-repeat; height:10px;}",
				"#chatbox .content::-webkit-scrollbar-track-piece:vertical { background:black; border:none;}",
				"#chatbox .content::-webkit-scrollbar-thumb:vertical { background:grey; -webkit-border-image:none; border-color:transparent;border-width: 0px 0; }"
			].join("\n"));
		});

		// Input selection
		this.ui.find('.input input').mousedown(function( event ){
			this.select();
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.find('.input .message').blur(function(){
			var _this = this;
			setTimeout(function(){
				if( document.activeElement.tagName !== 'INPUT' ) {
					_this.focus();
				}
			}, 1);
		});

		// Button change name
		this.ui.find('.header input').dblclick(function(){
			this.type = 'text';
			this.select();
		}).blur(function(){
			this.type = 'button';
		});

		// Change size
		this.ui.find('.input .size').mousedown(function( event ){
			ChatBox.updateHeight(true);
			event.stopImmediatePropagation();
			return false;
		});

		// Scroll feature should block at each line
		var lastScrollPos = 0;
		this.ui.find('.content').on('scroll', function(){
			if( this.scrollTop > lastScrollPos ) {
				this.scrollTop = Math.ceil(this.scrollTop/14) * 14;
			}
			else {
				this.scrollTop = Math.floor(this.scrollTop/14) * 14;
			}
			lastScrollPos = this.scrollTop;
		});
	};


	/**
	 * Clean up the box
	 */
	ChatBox.clean = function Clean()
	{
		this.ui.find('.content').empty();
		this.ui.find('.input .message').val('');
		this.ui.find('.input .username').val('');
	};


	/**
	 * Once append to HTML
	 */
	ChatBox.onAppend = function OnAppend()
	{
		// Focus the input
		this.ui.find('.input .message').focus();

		// Write memorized texts
		for( var i = 0, count = this.storage.length; i < count; ++i ) {
			this.addText.apply(this, this.storage[i]);
		}
		this.storage.length = 0;

		var content = this.ui.find('.content')[0];
		content.scrollTop = content.scrollHeight;
	};


	/**
	 * Stop custom scroll
	 */
	ChatBox.onRemove = function OnRemove()
	{
		this.ui.find('.content').off('scroll');
	};


	/**
	 * Key Event Handler
	 *
	 * @param {object} event - KeyEventHandler
	 * @return {boolean}
	 */
	ChatBox.onKeyDown = function OnKeyDown( event )
	{
		var is_focus = document.activeElement === this.ui.find('.input .message')[0];

		switch( event.which ) {
			default:
				return true;

			case KEYS.TAB:
				if( document.activeElement === this.ui.find('.input .message')[0] ) {
					this.ui.find('.input .username').select().focus();
				}
				else if( document.activeElement === this.ui.find('.input .username')[0] ) {
					this.ui.find('.input .message').select().focus();
				}
				else {
					return true;	
				}
				break;

			case KEYS.UP:
				if( !is_focus || jQuery('#NpcMenu').length ) {
					return true;
				}
				if( this.historyIndex > 0 ) {
					this.historyIndex--;
				}
				this.ui.find('.input .message').val( this.history[ this.historyIndex ] ).select();
				break;

			case KEYS.DOWN:
				if( !is_focus || jQuery('#NpcMenu').length ) {
					return true;
				}
				if( this.historyIndex < this.history.length ) {
					this.historyIndex++;
				}
				this.ui.find('.input .message').val( this.history[ this.historyIndex ] ).select();
				break;

			case KEYS.F10:
				this.updateHeight(false);
				break;

			case KEYS.ENTER:
				if( document.activeElement.tagName === 'INPUT' && !is_focus ) {
					return true;
				}
				if( jQuery('#NpcMenu').length || jQuery('#NpcBox').length ) {
					return true;
				}

				this.ui.find('.input .message').focus();
				this.submit();
				break;
		}
	
		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Process ChatBox message
	 */
	ChatBox.submit = function Submit()
	{
		var $user = this.ui.find('.input .username');
		var $text = this.ui.find('.input .message');

		var user = $user.val();
		var text = $text.val();

		// block.
		if( !text.length ) {
			return;
		}

		if( user.length && text[0] !== '/' ) {
			this.PrivateMessageStorage.nick = user;
			this.PrivateMessageStorage.msg  = text;
		}

		// Save in history
		if( this.history[this.historyIndex] !== text ) {

			if( this.history.length >= MAX_HISTORY ) {
				this.history.shift();
			}
			this.history.push(text);
		}
		this.historyIndex = this.history.length;
		$text.val('');

		if( text[0] === '/' ) {
			ProcessCommand.call( ChatBox, text.substr(1) );
			return;
		}

		this.onRequestTalk( user, text );
	};


	/**
	 * Storage to cache the private messages
	 */
	ChatBox.PrivateMessageStorage = {
		nick: "",
		msg:  ""
	};


	/**
	 *  If server want to display text but UI not loaded yet, store message and process later
	 */
	ChatBox.storage = [];


	/**
	 * Add text to chatbox
	 *
	 * @param {string} text
	 * @param {number} type
	 * @param {string} color
	 */
	ChatBox.addText = function addText( text, type, color )
	{
		if( !this.__loaded ) {
			this.storage.push(arguments);
			return;
		}

		var $content = this.ui.find('.content');

		if( !color ) {
			if( (type & ChatBox.TYPE.PUBLIC) && (type & ChatBox.TYPE.SELF) ) {
				color = '#00FF00';
			}
			else if( type & ChatBox.TYPE.PRIVATE ) {
				color = '#FFFF00';
			}
			else if( type & ChatBox.TYPE.ERROR ) {
				color = '#FF0000';
			}
			else if( type & ChatBox.TYPE.INFO ) {
				color = '#FFFF63';
			}
			else if( type & ChatBox.TYPE.BLUE ) {
				color = "#00FFFF";	
			}
			else {
				color = 'white';
			}
		}

		$content.append(
			jQuery('<div/>').
				css('color', color).
				text(text)
		);

		// If there is too many line, remove the older one
		var list = $content.find('div');
		if( list.length > MAX_MSG ) {
			list.find(':first').remove();
		}

		// Always put the scroll at the bottom
		$content[0].scrollTop = $content[0].scrollHeight;
	};


	/**
	 * @var {number} Chatbox position's index
	 */
	ChatBox.heightIndex = 2;


	/**
	 * Change chatbox's height
	 */
	ChatBox.updateHeight = function changeHeight( AlwaysVisible )
	{
		var HeightList   = [ 0, 0, 3*14, 6*14, 9*14, 12*14, 15*14 ];
		this.heightIndex = (this.heightIndex + 1) % HeightList.length;

		var $content   = this.ui.find('.content');
		var height     = HeightList[ this.heightIndex ];
		var top        = parseInt( this.ui.css('top'), 10);

		this.ui.css('top', top - (height - $content.height()) );
		$content.height(height);

		// Don't remove UI
		if( this.heightIndex === 0 && AlwaysVisible ) {
			this.heightIndex++;
		}

		switch( this.heightIndex ) {
			case 0:
				this.ui.hide();
				break;

			case 1:
				this.ui.show();
				this.ui.find('.header, .body').hide();
				this.ui.find('.input').addClass('fix');
				break;

			default:
				this.ui.find('.input').removeClass('fix');
				this.ui.find('.header, .body').show();
				break;
		}

		$content[0].scrollTop = $content[0].scrollHeight;
	};

	/**
	 * Talk feature
	 *
	 * @param {string} user
	 * @param {string} text
	 */
	ChatBox.onRequestTalk = function OnRequestTalk( user, text )
	{
		var pkt;

		if( user.length ) {
			pkt          = new PACKET.CZ.WHISPER();
			pkt.receiver = user;
			pkt.msg = text;
		}
		else if( text[0] === '%' ) {
			pkt = new PACKET.CZ.REQUEST_CHAT_PARTY();
			pkt.msg = Session.Entity.display.name + ' : ' + text.substr(1);
		}
		else if( text[0] === '$' ) {
			pkt = new PACKET.CZ.GUILD_CHAT();
			pkt.msg = Session.Entity.display.name + ' : ' + text.substr(1);
		}
		else {
			pkt = new PACKET.CZ.REQUEST_CHAT();
			pkt.msg = Session.Entity.display.name + ' : ' + text;
		}

		Network.sendPacket(pkt);
	};


	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(ChatBox);
});