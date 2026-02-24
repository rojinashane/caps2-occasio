import React from 'react';
import { Modal, View, KeyboardAvoidingView, Platform } from 'react-native';
import tw from 'twrnc';

export default function CustomModal({
    visible,
    animationType = 'fade',
    avoidKeyboard = false,
    children
}) {
    // The core UI of the modal (dark backdrop + white rounded box)
    const ModalContent = (
        <View style={tw`flex-1 bg-black bg-opacity-60 items-center justify-center px-6`}>
            <View style={tw`bg-white w-full rounded-3xl p-6`}>
                {children}
            </View>
        </View>
    );

    return (
        <Modal transparent visible={visible} animationType={animationType}>
            {avoidKeyboard ? (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={tw`flex-1`}
                >
                    {ModalContent}
                </KeyboardAvoidingView>
            ) : (
                ModalContent
            )}
        </Modal>
    );
}