#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NFT Market Web App - УПРАВЛЯЕМАЯ ВЕРСИЯ
"""

import json
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery
from database import db
from utils import format_balance
from config import ADMIN_IDS

# URL для Telegram Mini App
# Для продакшена загрузите HTML на GitHub Pages или другой хостинг
MINI_APP_URL = "https://kotokola.github.io/blackwiev-market/"

MANAGER_USERNAME = "ggyyert"
MANAGER_LINK = f"https://t.me/{MANAGER_USERNAME}"


async def cmd_nft_webapp(message: Message):
    """Открыть NFT Market Mini App (только кнопка)"""
    user_id = message.from_user.id
    user = db.get_user(user_id)

    if not user:
        db.register_user(user_id, message.from_user.username, message.from_user.first_name)
        user = db.get_user(user_id)

    # Проверяем, принял ли пользователь правила
    if not db.has_accepted_rules(user_id):
        await message.reply(
            f"📜 <b>Для доступа к NFT маркету необходимо принять правила!</b>",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📜 ПРИНЯТЬ ПРАВИЛА", callback_data="accept_nft_rules")]
            ])
        )
        return

    # Передаём данные пользователя через URL-параметры
    username = user.get('username', '') or message.from_user.username or ''
    first_name = user.get('first_name', '') or message.from_user.first_name or ''
    from urllib.parse import urlencode
    params = urlencode({
        'uid': user_id,
        'un': username,
        'fn': first_name
    })
    app_url = f"{MINI_APP_URL}?{params}"

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎨 ОТКРЫТЬ NFT MARKET", web_app=WebAppInfo(url=app_url))]
    ])

    await message.reply(
        "🎨 <b>NFT MARKET</b>\n\n"
        "Покупай, продавай, коллекционируй NFT!",
        reply_markup=keyboard,
        disable_web_page_preview=True
    )


async def nft_webapp_data_handler(message: Message):
    """Обработчик данных из Mini App"""
    if not message.web_app_data:
        return
    
    try:
        data = json.loads(message.web_app_data.data)
        action = data.get('action')
        user_id = message.from_user.id
        
        print(f"📱 WebApp запрос: {action} от {user_id}")
        
        if action == 'get_balance':
            balance = db.get_balance(user_id)
            user = db.get_user(user_id)
            username = ''
            first_name = ''
            if user:
                username = user.get('username', '') or ''
                first_name = user.get('first_name', '') or ''
            await message.answer(json.dumps({
                'action': 'get_balance',
                'balance': balance,
                'usdt': balance,
                'ton': 0,
                'stars': 0,
                'user_id': user_id,
                'username': username,
                'first_name': first_name
            }))
        
        elif action == 'get_market':
            listings = db.get_market_listings()
            result = []
            for item in listings:
                seller = db.get_user(item['owner_id'])
                seller_name = f"@{seller.get('username', '')}" if seller else f"ID: {item['owner_id']}"

                result.append({
                    'id': item['id'],
                    'name': item['name'],
                    'price': item.get('price', 0),
                    'currency': item.get('currency', 'USDT'),
                    'rarity': item.get('rarity', 'common'),
                    'owner_id': item['owner_id'],
                    'seller_name': seller_name,
                    'image_url': item.get('image_url', ''),
                    'token_link': item.get('token_link', '')
                })
            await message.answer(json.dumps({
                'action': 'get_market',
                'items': result
            }))
        
        elif action == 'get_my_nfts':
            nfts = db.get_nft(owner_id=user_id)
            result = []
            for nft in nfts:
                result.append({
                    'id': nft['id'],
                    'name': nft['name'],
                    'price': nft.get('price', 0),
                    'currency': nft.get('currency', 'USDT'),
                    'rarity': nft.get('rarity', 'common'),
                    'is_listed': nft.get('is_listed', False),
                    'status': nft.get('status', 'active'),
                    'image_url': nft.get('image_url', ''),
                    'token_link': nft.get('token_link', '')
                })
            await message.answer(json.dumps({
                'action': 'get_my_nfts',
                'items': result,
                'user_id': user_id
            }))
        
        elif action == 'get_transactions':
            transactions = db.get_user_transactions(user_id, 20)
            result = []
            for tx in transactions:
                result.append({
                    'id': tx['id'],
                    'type': tx['type'],
                    'amount': tx['amount'],
                    'currency': tx.get('currency', 'USDT'),
                    'date': tx['created_at'][:19] if tx.get('created_at') else '',
                    'details': tx.get('details', '')
                })
            await message.answer(json.dumps({
                'action': 'get_transactions',
                'items': result,
                'user_id': user_id
            }))
        
        elif action == 'accept_rules':
            db.set_rules_accepted(user_id)
            await message.answer(json.dumps({
                'action': 'accept_rules',
                'success': True,
                'message': 'Правила приняты!'
            }))
        
        # ========== NFT PURCHASE (MINI APP) ==========
        elif action == 'create_purchase_request':
            if not db.has_accepted_rules(user_id):
                await message.answer(json.dumps({
                    'error': True,
                    'message': 'Не приняты правила'
                }))
                return
            
            nft_id = data.get('nft_id')
            offer_price = data.get('offer_price')
            currency = data.get('currency', 'USDT')
            
            if nft_id is None or offer_price is None:
                await message.answer(json.dumps({
                    'error': True,
                    'message': 'nft_id и offer_price обязательны'
                }))
                return
            
            # В этой системе: offer_price должен совпадать с текущей ценой, либо админ сам сможет отклонить.
            # Для надежности: подтягиваем цену из nft_items если offer_price не передан валидно.
            try:
                offer_price = float(offer_price)
            except:
                await message.answer(json.dumps({'error': True, 'message': 'offer_price должен быть числом'}))
                return
            
            req_id = db.create_nft_purchase_request(
                buyer_id=user_id,
                nft_id=int(nft_id),
                offer_price=offer_price,
                currency=currency
            )
            
            if not req_id:
                await message.answer(json.dumps({
                    'error': True,
                    'message': 'Не удалось создать заявку. NFT может быть не листингом или уже продан.'
                }))
                return
            
            await message.answer(json.dumps({
                'action': 'create_purchase_request',
                'success': True,
                'request_id': req_id,
                'message': 'Заявка на покупку отправлена на рассмотрение админам.'
            }))
        
        elif action == 'get_my_purchase_requests':
            reqs = db.get_user_pending_nft_purchase_requests(user_id)
            await message.answer(json.dumps(reqs))
        
        # ========== NFT MARKET / USER ACTIONS ==========
        elif action == 'create_withdraw':
            amount = data.get('amount', 0)
            
            if amount < 1:
                await message.answer(json.dumps({
                    'error': True,
                    'message': 'Минимальная сумма вывода: 1 USDT'
                }))
                return
            
            balance = db.get_balance(user_id)
            if amount > balance:
                await message.answer(json.dumps({
                    'error': True,
                    'message': f'Недостаточно средств. Ваш баланс: {format_balance(balance)} USDT'
                }))
                return
            
            # Списываем средства
            db.update_balance(user_id, -amount)
            db.update_total_withdrawn(user_id, amount)
            
            # Уведомляем админов
            for admin_id in ADMIN_IDS:
                try:
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [
                            InlineKeyboardButton(text="✅ Подтвердить выплату", callback_data=f"confirm_withdraw_{user_id}_{amount}"),
                            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_withdraw_{user_id}_{amount}")
                        ]
                    ])
                    
                    await message.bot.send_message(
                        admin_id,
                        f"💸 <b>ЗАЯВКА НА ВЫВОД ИЗ MINI APP!</b>\n\n"
                        f"👤 <b>Пользователь:</b> <a href='tg://user?id={user_id}'>{message.from_user.first_name}</a>\n"
                        f"🆔 <b>ID:</b> <code>{user_id}</code>\n"
                        f"💰 <b>Сумма:</b> {format_balance(amount)} USDT",
                        reply_markup=keyboard
                    )
                except:
                    pass
            
            await message.answer(json.dumps({
                'success': True,
                'message': f'Заявка на вывод {format_balance(amount)} USDT создана! Менеджер свяжется с вами.',
                'new_balance': db.get_balance(user_id)
            }))
        
        elif action == 'list_nft':
            nft_id = data.get('nft_id')
            price = data.get('price')
            currency = data.get('currency', 'USDT')
            
            nft = db.get_nft(nft_id=nft_id)
            if not nft:
                await message.answer(json.dumps({'error': True, 'message': 'NFT не найден'}))
                return
            
            if nft['owner_id'] != user_id:
                await message.answer(json.dumps({'error': True, 'message': 'Это не ваш NFT'}))
                return
            
            success = db.set_nft_price(nft_id, user_id, price, currency)
            if success:
                await message.answer(json.dumps({'success': True, 'message': 'NFT выставлен на продажу!'}))
            else:
                await message.answer(json.dumps({'error': True, 'message': 'Ошибка выставления NFT'}))
        
        elif action == 'unlist_nft':
            nft_id = data.get('nft_id')
            
            nft = db.get_nft(nft_id=nft_id)
            if not nft:
                await message.answer(json.dumps({'error': True, 'message': 'NFT не найден'}))
                return
            
            if nft['owner_id'] != user_id:
                await message.answer(json.dumps({'error': True, 'message': 'Это не ваш NFT'}))
                return
            
            db.unlist_nft(nft_id, user_id)
            await message.answer(json.dumps({'success': True, 'message': 'NFT снят с продажи!'}))
        
        elif action == 'check_rules':
            rules_accepted = db.has_accepted_rules(user_id)
            await message.answer(json.dumps({
                'rules_accepted': rules_accepted
            }))
        
        else:
            await message.answer(json.dumps({'action': action, 'error': 'unknown_action'}))
            
    except Exception as e:
        print(f"❌ Ошибка обработки WebApp: {e}")
        import traceback
        traceback.print_exc()
        await message.answer(json.dumps({'error': str(e)}))


async def handle_nft_callback(call: CallbackQuery):
    """Обработчик callback для NFT команд"""
    user_id = call.from_user.id
    data = call.data
    
    if data == "accept_nft_rules":
        db.set_rules_accepted(user_id)
        
        # Удаляем старое сообщение с правилами
        await call.message.delete()
        
        # Создаем кнопку для открытия мини-приложения
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="👤 ОТКРЫТЬ ПРОФИЛЬ", web_app=WebAppInfo(url=MINI_APP_URL))]
        ])
        
        # Отправляем новое сообщение с кнопкой
        await call.message.answer(
            f"✅ <b>Правила приняты!</b>\n\n"
            f"Теперь вы можете пользоваться NFT маркетом.\n\n"
            f"👆 Нажмите кнопку ниже, чтобы открыть профиль.",
            reply_markup=keyboard
        )
        await call.answer("✅ Правила приняты!")
    
    elif data.startswith("approve_purchase_") or data.startswith("reject_purchase_"):
        if call.from_user.id not in ADMIN_IDS:
            await call.answer("❌ Доступ запрещен")
            return
        
        parts = data.split("_")
        request_id = int(parts[2])
        
        if data.startswith("approve_purchase_"):
            ok = db.approve_nft_purchase_request(request_id=request_id, admin_id=user_id)
            await call.message.edit_text(
                f"✅ <b>Заявка #{request_id} одобрена</b>" if ok else f"❌ <b>Не удалось одобрить #{request_id}</b>"
            )
            await call.answer("✅ Одобрено" if ok else "Ошибка")
        else:
            ok = db.reject_nft_purchase_request(request_id=request_id, admin_id=user_id, reason="rejected")
            await call.message.edit_text(
                f"❌ <b>Заявка #{request_id} отклонена</b>" if ok else f"❌ <b>Не удалось отклонить #{request_id}</b>"
            )
            await call.answer("❌ Отклонено" if ok else "Ошибка")
        
    elif data.startswith("confirm_withdraw_"):
        if call.from_user.id not in ADMIN_IDS:
            await call.answer("❌ Доступ запрещен")
            return
        
        parts = data.split("_")
        target_user_id = int(parts[2])
        amount = float(parts[3])
        
        await call.message.edit_text(
            f"✅ <b>Выплата подтверждена!</b>\n\n"
            f"👤 Пользователь: <code>{target_user_id}</code>\n"
            f"💰 Сумма: {format_balance(amount)} USDT\n\n"
            f"Статус: Выплачено"
        )
        
        # Уведомляем пользователя
        try:
            await call.bot.send_message(
                target_user_id,
                f"✅ <b>Ваша заявка на вывод одобрена!</b>\n\n"
                f"💰 Сумма: {format_balance(amount)} USDT\n\n"
                f"Менеджер свяжется с вами для отправки средств."
            )
        except:
            pass
        
        await call.answer("✅ Выплата подтверждена")
    
    elif data.startswith("reject_withdraw_"):
        if call.from_user.id not in ADMIN_IDS:
            await call.answer("❌ Доступ запрещен")
            return
        
        parts = data.split("_")
        target_user_id = int(parts[2])
        amount = float(parts[3])
        
        # Возвращаем средства
        db.update_balance(target_user_id, amount)
        
        await call.message.edit_text(
            f"❌ <b>Заявка отклонена!</b>\n\n"
            f"👤 Пользователь: <code>{target_user_id}</code>\n"
            f"💰 Сумма: {format_balance(amount)} USDT\n\n"
            f"Средства возвращены на баланс."
        )
        
        # Уведомляем пользователя
        try:
            await call.bot.send_message(
                target_user_id,
                f"❌ <b>Ваша заявка на вывод отклонена!</b>\n\n"
                f"💰 Сумма: {format_balance(amount)} USDT\n\n"
                f"Средства возвращены на ваш баланс.\n"
                f"По вопросам обращайтесь к менеджеру: <a href='{MANAGER_LINK}'>@{MANAGER_USERNAME}</a>",
                disable_web_page_preview=True
            )
        except:
            pass
        
        await call.answer("❌ Заявка отклонена")