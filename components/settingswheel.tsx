import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function SettingsButton() {
    return (
        <View style={styles.container}>
            <Link href="../settingsScreen">
                <Pressable>
                    <Image source={require("../assets/images/settingswheel.png")}
                        style={styles.image}
                    />
                </Pressable>
            </Link>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 150,
        height: 150
    },
    image: {
        width: 150,
        height: 150
    }
})